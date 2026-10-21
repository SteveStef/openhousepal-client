'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Loader2, RefreshCw, Search } from 'lucide-react'
import api, { type GoogleSearchStatus } from '@/lib/api-service'

// IDX editor -> Google tab: "Show up on Google". Nothing for the agent to do - once the site is
// published, OpenHousePal proves to Google it's a real site, adds it to Google Search Console and
// hands Google the list of pages (backend google_search_service; Bing gets a ping every publish).
// This card just says where that's at. "Use my own Google account" is an optional extra for the
// rare agent who wants it in their own Search Console.

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '')

export default function GoogleListingCard() {
  const [s, setS] = useState<GoogleSearchStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [own, setOwn] = useState(false)
  const [code, setCode] = useState('')
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let live = true
    const load = () => api.sites.getGoogleStatus().then(r => { if (live && r.success && r.data) setS(r.data) })
    load()
    // While it's working, check back every 20s so the green tick shows up on its own.
    const t = setInterval(() => { if (s?.state === 'working') load() }, 20000)
    return () => { live = false; clearInterval(t) }
  }, [s?.state])

  useEffect(() => { if (s) setCode(c => c || s.manual_code || '') }, [s])

  const retry = async () => {
    setBusy(true)
    const r = await api.sites.retryGoogle()
    setBusy(false)
    if (r.success && r.data) setS({ ...r.data, state: 'working', last_error: null })
  }

  const saveCode = async (value: string) => {
    setBusy(true)
    const r = await api.sites.setGoogleCode(value)
    setBusy(false)
    if (r.success && r.data) {
      setS(r.data)
      setCode(r.data.manual_code || '')
      setCodeMsg({ ok: true, text: r.data.manual_code ? 'Saved - it\'s on your home page within a minute. Now press Verify in Google.' : 'Removed.' })
    } else {
      setCodeMsg({ ok: false, text: r.error || 'That didn\'t save - try again.' })
    }
  }

  if (!s) return null
  const done = s.state === 'done'
  const headline = {
    done: 'Google has your site',
    working: 'Sending your site to Google…',
    error: 'Almost there',
    not_live: 'Publish to show up on Google',
    hidden: 'Hidden from Google',
    unavailable: 'Show up on Google',
  }[s.state]
  const line = {
    done: `We proved to Google that ${s.host} is your site and handed it the list of every page. New and changed pages are sent automatically.`,
    working: `We're proving to Google that ${s.host} is your site and handing it the list of every page. Nothing for you to do - this takes a few minutes.`,
    error: s.last_error || 'Google didn\'t answer - we\'ll keep trying on our own.',
    not_live: 'Once your site is published, we tell Google about it for you - nothing to set up.',
    hidden: '"Let Google find my site" is off below, so we\'re not sending it to Google.',
    unavailable: 'Your site already gives Google a list of every page and your business details, so Google finds it on its own - usually within a few weeks.',
  }[s.state]

  return (
    <div className={`rounded-2xl border p-4 ${done ? 'border-emerald-300/70 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-400/[0.06]' : 'border-[#C9A24D]/40 bg-[#fffaf0] dark:border-white/10 dark:bg-white/[0.03]'}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${done ? 'bg-emerald-500 text-white' : 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]'}`}>
          {done ? <Check className="h-4 w-4" strokeWidth={3.5} /> : s.state === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#111827] dark:text-white">{headline}</p>
          <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-gray-600 dark:text-gray-400">{line}</p>
          {(done || s.indexnow_pinged_at) && (
            <ul className="mt-2 space-y-1 text-[11px] font-bold text-gray-700 dark:text-gray-300">
              {s.verified_at && <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" strokeWidth={3.5} />Google confirmed it&apos;s your site · {day(s.verified_at)}</li>}
              {s.sitemap_submitted_at && <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" strokeWidth={3.5} />Page list sent to Google · {day(s.sitemap_submitted_at)}</li>}
              {s.indexnow_pinged_at && <li className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-600" strokeWidth={3.5} />Bing told about your latest publish · {day(s.indexnow_pinged_at)}</li>}
            </ul>
          )}
          {done && (
            <p className="mt-2 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
              Google usually starts showing a new site within a few days to two weeks. Searching your name is the quickest test.
            </p>
          )}
          {s.state === 'error' && (
            <button type="button" onClick={retry} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3 py-1.5 text-[11px] font-black text-white transition hover:-translate-y-0.5 disabled:opacity-60 dark:bg-white dark:text-[#111827]">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Try again now
            </button>
          )}
        </div>
      </div>

      {/* Optional - most agents never need this */}
      <button type="button" onClick={() => setOwn(o => !o)} className="mt-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:text-[#111827] dark:hover:text-white">
        Use my own Google account too (optional) <ChevronDown className={`h-3 w-3 transition ${own ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {own && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-[#0B0B0B]">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                Only if you want to see Google&apos;s reports yourself.{done ? ' Your site is already in Google either way.' : ''}
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                <li>Open <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="font-black text-[#8b7355] underline dark:text-[#e8c97a]">Google Search Console</a> and sign in with your Google account.</li>
                <li>Add a property, choose <b>URL prefix</b>, and type <b className="break-all">{s.site_url}</b></li>
                <li>Pick <b>HTML tag</b>, copy the line Google shows, and paste it below.</li>
                <li>Press <b>Save</b> here, wait a minute, then press <b>Verify</b> in Google.</li>
                <li>In Google, open <b>Sitemaps</b> and add <b className="break-all">{s.sitemap_url}</b></li>
              </ol>
              <div className="mt-2.5 flex gap-2">
                <input value={code} onChange={e => { setCode(e.target.value); setCodeMsg(null) }} placeholder={'<meta name="google-site-verification" content="...">'}
                  className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold outline-none transition focus:border-[#C9A24D] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white" />
                <button type="button" onClick={() => saveCode(code)} disabled={busy || code.trim() === (s.manual_code || '')} className="rounded-xl bg-[#111827] px-3 py-2 text-[11px] font-black text-white transition disabled:opacity-40 dark:bg-white dark:text-[#111827]">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </button>
              </div>
              {s.manual_code && <button type="button" onClick={() => saveCode('')} className="mt-1.5 text-[10px] font-black text-gray-400 transition hover:text-red-600">Remove my code</button>}
              {codeMsg && <p className={`mt-1.5 text-[11px] font-bold ${codeMsg.ok ? 'text-emerald-600' : 'text-amber-600'}`}>{codeMsg.text}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
