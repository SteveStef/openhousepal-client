'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { copyText } from '@/lib/copyText'

// Step-by-step "connect your own domain" for an agent who has never touched DNS: pick the company
// they bought the domain from, then exact clicks in plain words. Always the same two things - a
// "www" record (works at every company) and the company's forwarding for the bare name - see
// backend domain_verification_service.build_instructions. Menu names checked against each
// company's own help pages (Oct 2026).

export type DomainProvider = 'godaddy' | 'namecheap' | 'squarespace' | 'cloudflare' | 'wix' | 'other'

const PROVIDERS: { id: DomainProvider; label: string }[] = [
  { id: 'godaddy', label: 'GoDaddy' },
  { id: 'namecheap', label: 'Namecheap' },
  { id: 'squarespace', label: 'Squarespace' },
  { id: 'cloudflare', label: 'Cloudflare' },
  { id: 'wix', label: 'Wix' },
  { id: 'other', label: 'Somewhere else' },
]

type Step = { title: string; body: string; record?: boolean; forward?: boolean }

function stepsFor(p: DomainProvider, apex: string, label: string, pair: boolean): Step[] {
  const where: Record<DomainProvider, string> = {
    godaddy: 'Sign in at godaddy.com, open My Products, and next to your domain choose DNS.',
    namecheap: 'Sign in at namecheap.com, open Domain List, choose Manage next to your domain, then the Advanced DNS tab.',
    squarespace: 'Sign in at account.squarespace.com/domains, click your domain, then DNS and DNS Settings. (Domains that used to be with Google Domains are here too.)',
    cloudflare: 'Sign in at dash.cloudflare.com, click your domain, then DNS and Records.',
    wix: 'Sign in at wix.com, open Domains, click the three dots next to your domain and choose Manage DNS Records.',
    other: 'Sign in where you bought the domain and find its DNS settings. It may be called "DNS", "DNS records", "Zone editor" or "Advanced DNS".',
  }
  const add: Record<DomainProvider, string> = {
    godaddy: 'Choose Add New Record. Set Type to CNAME, Name to the value below, and Value to the address below. Leave TTL as it is and save. If a "www" record is already there, edit that one instead.',
    namecheap: 'Choose Add New Record and pick CNAME Record. Put the name below in Host and the address below in Value, then click the green check. If there is already a "www" record or a URL Redirect for www, delete it.',
    squarespace: 'Under Custom records choose Add record. Set Host to the name below, Type to CNAME and Data to the address below, then Save. If Squarespace already has a "www" record, remove it.',
    cloudflare: 'Choose Add record. Type CNAME, Name below, Target below. Set Proxy status to "DNS only" (grey cloud) - this matters - then Save.',
    wix: 'In the CNAME (Aliases) section choose + Add Record. Host name is the name below, Value is the address below. Save. Delete any older "www" CNAME so the two don\'t clash.',
    other: 'Add a new record of type CNAME. Name (sometimes "Host" or "Alias") is the value below; Value (sometimes "Points to" or "Target") is the address below.',
  }
  const forward: Record<DomainProvider, string> = {
    godaddy: 'Back on your domain\'s page, open Forwarding, add a forward for the domain itself, send it to the address below and pick Permanent (301). Save.',
    namecheap: 'Choose Add New Record again and pick URL Redirect Record. Host is @, Value is the address below, and choose Permanent (301). Click the green check.',
    squarespace: 'In your domain\'s menu open Domain forwarding (sometimes under Website), add a rule for the domain itself (@) to the address below, set as a permanent (301) redirect, and save.',
    cloudflare: 'Open Rules, then Redirect Rules, and create one from the "Redirect from root to WWW" template. It sends the domain to the address below. Deploy it.',
    wix: 'Wix only forwards a domain on some plans. Look for "Redirect" in your domain\'s three-dot menu; if it isn\'t there, skip this step and share the www address instead.',
    other: 'Find "Forwarding", "Redirect" or "URL redirect" and send the domain itself to the address below as a permanent (301) redirect.',
  }
  const steps: Step[] = [
    { title: 'Open your domain\'s DNS settings', body: where[p] },
    { title: `Add the ${label === 'www' ? '"www"' : `"${label}"`} record`, body: add[p], record: true },
  ]
  if (pair) steps.push({ title: `Send ${apex} to the www address`, body: forward[p], forward: true })
  return steps
}

function CopyValue({ value }: { value: string }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" onClick={() => copyText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) }).catch(() => {})}
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black uppercase tracking-wide transition ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10' : 'border-gray-200 bg-white text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60'}`}>
      {done ? <Check className="h-3 w-3" strokeWidth={3} /> : <Copy className="h-3 w-3" />}{done ? 'Copied' : 'Copy'}
    </button>
  )
}

function Field({ k, v, copy = true }: { k: string; v: string; copy?: boolean }) {
  return (
    // label above the value - side by side squeezed values to one letter per line on phones
    <div className="border-t border-gray-100 px-3 py-2 first:border-t-0 dark:border-white/[0.06]">
      <span className="block text-[10px] font-black uppercase tracking-wide text-gray-400">{k}</span>
      <div className="mt-0.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-[13px] font-bold text-[#111827] dark:text-white">{v}</code>
        {copy && <CopyValue value={v} />}
      </div>
    </div>
  )
}

export default function DomainSetupGuide({ hostname, target, pair }: { hostname: string; target: string; pair: boolean }) {
  const apex = hostname.replace(/^www\./, '')
  const label = pair ? 'www' : hostname.split('.')[0]
  const [provider, setProvider] = useState<DomainProvider>('godaddy')
  useEffect(() => {
    try { const saved = localStorage.getItem('ohp-domain-provider') as DomainProvider | null; if (saved) setProvider(saved) } catch { /* private window */ }
  }, [])
  const pick = (p: DomainProvider) => { setProvider(p); try { localStorage.setItem('ohp-domain-provider', p) } catch { /* ignore */ } }
  const steps = stepsFor(provider, apex, label, pair)
  const forSupport = [
    `Please set up my domain ${apex}:`,
    `1. Add a CNAME record: name "${label}", value "${target}".`,
    ...(pair ? [`2. Forward ${apex} to https://www.${apex} (permanent 301 redirect).`] : []),
  ].join('\n')

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[12px] font-black text-[#111827] dark:text-white">Where did you buy {apex}?</p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Your domain company">
        {PROVIDERS.map(p => (
          <button key={p.id} type="button" role="tab" aria-selected={provider === p.id} onClick={() => pick(p.id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${provider === p.id ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-[#C9A24D] dark:bg-white/[0.05] dark:text-white/70 dark:ring-white/10'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <ol className="mt-3.5 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#C9A24D] to-[#e8c97a] text-[11px] font-black text-[#111827]">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-black leading-snug text-[#111827] dark:text-white">{s.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-gray-600 dark:text-white/60">{s.body}</p>
              {s.record && (
                <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-black/20">
                  <Field k="Type" v="CNAME" copy={false} />
                  <Field k="Name" v={label} />
                  <Field k="Value" v={target} />
                </div>
              )}
              {s.forward && (
                <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-black/20">
                  <Field k="Forward" v={apex} copy={false} />
                  <Field k="To" v={`https://www.${apex}`} />
                  <Field k="Type" v="Permanent (301)" copy={false} />
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 dark:border-white/10">
        <p className="min-w-0 flex-1 text-[11px] font-semibold text-gray-500 dark:text-white/50">Changes usually show up within an hour, sometimes up to a day. We check every few minutes and email you when it&apos;s live. Stuck? Send these steps to your domain company - they do this every day.</p>
        <CopyValue value={forSupport} />
      </div>
    </div>
  )
}
