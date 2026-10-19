'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { copyText } from '@/lib/copyText'

// Step-by-step "connect your own domain" for an agent who has never touched DNS: pick the company
// they bought the domain from, then exact clicks in plain words. Always the same two things - a
// "www" record (works at every company) and the company's forwarding for the bare name - see
// backend domain_verification_service.build_instructions. Menu names checked against each
// company's own help pages (Oct 2026). Rewritten 10/19 after a real GoDaddy connection: their
// forwarding box has its own http:// / https:// dropdown that starts on http:// (that forward
// landed on a 404), and most companies already have a "www" row to edit rather than add.

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

// How each company's forwarding box wants the address: GoDaddy splits it into a protocol dropdown
// and the rest; the others take the whole https:// address.
const SPLIT_PROTOCOL: DomainProvider[] = ['godaddy']

function stepsFor(p: DomainProvider, apex: string, label: string, pair: boolean): Step[] {
  const where: Record<DomainProvider, string> = {
    godaddy: `Sign in at godaddy.com. Open your Domain Portfolio (your name at the top right, then My Products, then Domains), click ${apex}, then the DNS tab.`,
    namecheap: 'Sign in at namecheap.com, open Domain List, click Manage next to your domain, then the Advanced DNS tab.',
    squarespace: 'Sign in at account.squarespace.com/domains and click your domain, then DNS in the left menu. (Domains that used to be with Google Domains are here too.)',
    cloudflare: 'Sign in at dash.cloudflare.com, click your domain, then DNS and Records.',
    wix: 'Sign in at wix.com, open Domains, click the three dots next to your domain and choose Manage DNS Records.',
    other: 'Sign in where you bought the domain and find its DNS settings. It may be called "DNS", "DNS records", "Zone editor" or "Advanced DNS".',
  }
  const add: Record<DomainProvider, string> = {
    godaddy: 'In DNS Records, GoDaddy usually already has a "www" row (Type CNAME, Value @). Click its pencil icon, change Value to the address below and Save. Only if there is no "www" row: choose Add New Record, Type CNAME, Name and Value below, Save.',
    namecheap: 'In Host Records, Namecheap usually already has a "www" row (CNAME to parkingpage.namecheap.com). Click it to edit, change Value to the address below and click the green check. No "www" row? Choose Add New Record, then CNAME Record, Host and Value below.',
    squarespace: 'Under Custom records choose Add record: Host is the name below, Type CNAME, Data the address below. Save. If a "www" row is listed under Squarespace Defaults, delete those defaults first (only if you don\'t use a Squarespace website).',
    cloudflare: 'Choose Add record: Type CNAME, Name and Target below, and set Proxy status to "DNS only" (grey cloud, not orange) - this matters. Save. If a "www" record already exists, edit it instead.',
    wix: 'In the CNAME (Aliases) section, edit the "www" row if there is one, or choose + Add Record: Host name and Value below. Save.',
    other: 'Add a record of type CNAME (or edit the "www" one if it\'s already there). Name (sometimes "Host" or "Alias") and Value (sometimes "Points to" or "Target") are below.',
  }
  const forward: Record<DomainProvider, string> = {
    godaddy: 'Still in your domain, open the Forwarding tab (next to DNS Records) and choose Add Forwarding, then Domain. The destination box has a small dropdown on its left that starts on http:// - switch it to https:// (http:// shows "page not found"), then type only the address below. Forward type: Permanent (301). Keep "Forward only" (not masking). Save, and say yes if GoDaddy offers to update your DNS for it. Takes up to an hour.',
    namecheap: 'Namecheap usually already has a URL Redirect Record for "@" - edit it (or Add New Record, then URL Redirect Record): Host @, Value the full address below, and pick Permanent (301) in the dropdown. Click the green check. Leave MX and TXT records alone - those are your email.',
    squarespace: 'In the left menu open Domain forwarding and choose Add forwarding rule. Leave Subdomain empty (that\'s the domain itself), Destination is the address below, Redirect type: Permanent redirect (301), Path forwarding: forward the path, SSL: on. Save.',
    cloudflare: 'The domain itself needs one record with an orange cloud: if it has none, add an A record with Name @, IPv4 address 192.0.2.1, Proxied. Then open Rules, choose Create rule, Redirect Rule, and use the "Redirect from Root to WWW" template - check the target is the address below and the status is 301. Deploy.',
    wix: 'Wix can\'t forward a domain to a website outside Wix, so skip this step: share the www address (it works now). If you want the short name to work too, you can move the domain to GoDaddy or Namecheap later.',
    other: 'Find "Forwarding", "Redirect" or "URL redirect" and send the domain itself to the full address below as a permanent (301) redirect. If there\'s an http:// or https:// choice, pick https://.',
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
    ...(pair ? [`2. Forward ${apex} to https://www.${apex} (permanent 301 redirect, https - not http).`] : []),
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
              {s.forward && provider !== 'wix' && (
                <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-black/20">
                  <Field k="Forward" v={apex} copy={false} />
                  {SPLIT_PROTOCOL.includes(provider) ? (
                    <>
                      <Field k="Dropdown" v="https://" copy={false} />
                      <Field k="Destination" v={`www.${apex}`} />
                    </>
                  ) : <Field k="To" v={`https://www.${apex}`} />}
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
