'use client'

import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, MousePointerClick, Pencil, Sparkles } from 'lucide-react'
import { copyText } from '@/lib/copyText'
import api from '@/lib/api-service'

// "Connect your own domain" for an agent who has never touched DNS (user, 10/19 - "so easy a
// grandma could do it"): we work out which company the domain is with (its nameservers), then it's
// one action per line, a button that opens that company's DNS page for this exact domain (with the
// clicks to get there underneath, in case the link ever changes), copy buttons for every value, a
// simple drawing of the screen with the spot to change circled, and the company's own help article
// (real screenshots). Always the same two jobs - point "www" at us, and forward the short name to
// the https www address - see backend domain_verification_service.build_instructions.
// Facts per company researched Oct 2026 (forwarding support, https on the short name, menu names,
// deep links checked to resolve).

export type DomainProvider = 'godaddy' | 'squarespace' | 'namecheap' | 'wix' | 'ionos' | 'cloudflare' | 'networksolutions' | 'porkbun' | 'hostinger' | 'other'

type Line = string | { text: string; copy: string } | { text: string; value: string }

type Guide = {
  name: string
  /** Opens the DNS page for this domain (signed in) - null when the company has no stable link. */
  dnsUrl: ((d: string) => string) | null
  home: string
  /** The clicks to the DNS page, if the link doesn't land there. */
  path: string
  record: { lines: Line[]; cols: [string, string, string]; edit: boolean; proxy?: boolean; note?: string }
  forward:
    | { can: true; url?: (d: string) => string; lines: Line[]; split?: boolean; note?: string; httpsShortOk: boolean; labels: { to: string; type: string } }
    | { can: false; why: string }
  help: { dns: string; forward?: string }
}

const T = (target: string) => ({ text: 'Value', copy: target })

function guides(apex: string, target: string): Record<DomainProvider, Guide> {
  const www = `www.${apex}`
  const full = `https://www.${apex}`
  return {
    godaddy: {
      name: 'GoDaddy',
      dnsUrl: d => `https://dcc.godaddy.com/control/portfolio/${d}/settings?tab=dns`,
      home: 'godaddy.com',
      path: `godaddy.com → Sign In → your name (top right) → My Products → Domains → ${apex} → DNS`,
      record: {
        edit: true, cols: ['Type', 'Name', 'Data'],
        lines: [
          'Find the line where Name says www.',
          'Click the pencil ✏️ at the end of that line.',
          'Delete what\'s in the Value box and paste this in:', T(target),
          'Click Save.',
        ],
        note: 'No www line? Click Add New Record → Type: CNAME → Name: www → Value: paste the address above → Save.',
      },
      forward: {
        can: true, split: true, httpsShortOk: true, labels: { to: 'Destination', type: 'Permanent (301)' },
        lines: [
          'At the top, click the Forwarding tab (next to DNS Records).',
          'Click Add Forwarding, then Domain.',
          'The small box on the left says http:// - click it and pick https://',
          'In the big box, type:', { text: 'Destination', copy: www },
          'Forward type: Permanent (301). Leave "Forward only" picked.',
          'Click Save. If GoDaddy asks to update your DNS, click Yes.',
        ],
      },
      help: { dns: 'https://www.godaddy.com/help/edit-a-cname-record-19237', forward: 'https://www.godaddy.com/help/forward-my-godaddy-domain-12123' },
    },
    squarespace: {
      name: 'Squarespace',
      dnsUrl: d => `https://account.squarespace.com/domains/managed/${d}/dns/dns-settings`,
      home: 'account.squarespace.com/domains',
      path: `account.squarespace.com/domains → Sign In → ${apex} → DNS → DNS Settings (Google Domains moved here too)`,
      record: {
        edit: false, cols: ['Host', 'Type', 'Data'],
        lines: [
          'Not using a Squarespace website? Find "Squarespace Defaults" and click Delete (it has a www line in it).',
          'Under Custom Records, click Add record.',
          { text: 'Host', value: 'www' },
          { text: 'Type', value: 'CNAME' },
          'Data - paste this in:', { text: 'Data', copy: target },
          'Click Save.',
        ],
      },
      forward: {
        can: true, httpsShortOk: true, labels: { to: 'Destination', type: 'Permanent Redirect (301)' },
        note: 'Do the www step first - Squarespace locks the DNS while a forward is on.',
        lines: [
          'In your domain\'s menu, click Website, then Domain Forwarding Rules → Add rule (sign in again if asked).',
          'Subdomain: @ (or leave it empty).',
          'Destination - type:', { text: 'Destination', copy: www },
          'Open Advanced: pick Permanent Redirect (301), and turn SSL on.',
          'Click Save.',
        ],
      },
      help: { dns: 'https://support.squarespace.com/hc/en-us/articles/215744668-Pointing-a-Squarespace-domain', forward: 'https://support.squarespace.com/hc/en-us/articles/214767107-Forwarding-a-domain' },
    },
    namecheap: {
      name: 'Namecheap',
      dnsUrl: d => `https://ap.www.namecheap.com/Domains/DomainControlPanel/${d}/advancedns`,
      home: 'namecheap.com',
      path: `namecheap.com → Sign In → Domain List → Manage (next to ${apex}) → Advanced DNS`,
      record: {
        edit: true, cols: ['Type', 'Host', 'Value'],
        lines: [
          'Find the line where Host says www (it points to "parkingpage").',
          'Click on its Value and replace it with:', T(target),
          'Click the green ✓ checkmark.',
        ],
        note: 'No www line? Click Add New Record → CNAME Record → Host: www → Value: paste the address above → ✓.',
      },
      forward: {
        can: true, httpsShortOk: false, labels: { to: 'Value', type: 'Permanent (301)' },
        lines: [
          'Same page. If there\'s a line with Type "A Record" and Host "@", delete it (trash can).',
          'Click Add New Record → URL Redirect Record.',
          { text: 'Host', value: '@' },
          'Value - paste this in:', { text: 'Value', copy: full },
          'In the little menu, pick Permanent (301). Click the green ✓.',
        ],
      },
      help: { dns: 'https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/', forward: 'https://www.namecheap.com/support/knowledgebase/article.aspx/385/2237/how-to-set-up-a-url-redirect-for-a-domain/' },
    },
    wix: {
      name: 'Wix',
      dnsUrl: () => 'https://manage.wix.com/account/domains',
      home: 'wix.com',
      path: `wix.com → Sign In → Domains → the ⋯ next to ${apex} → Manage DNS Records`,
      record: {
        edit: true, cols: ['Type', 'Host name', 'Value'],
        lines: [
          `Click the ⋯ next to ${apex}, then Manage DNS Records.`,
          'Scroll to CNAME (Aliases). Edit the www line, or click + Add Record.',
          { text: 'Host name', value: 'www' },
          'Value - paste this in:', T(target),
          'Click Save.',
        ],
        note: 'If this domain is still connected to a Wix website, Wix keeps "www" for it - disconnect it from the Wix site first.',
      },
      forward: {
        can: false,
        why: `Wix can't send the short name (${apex}) to a website outside Wix - so skip this. Your website works at ${www}: put that address on your cards, email signature and ads. Want the short one too? Move the domain to GoDaddy and come back to this page.`,
      },
      help: { dns: 'https://support.wix.com/en/article/adding-or-update-cname-records-in-your-wix-account' },
    },
    ionos: {
      name: 'IONOS',
      dnsUrl: d => `https://my.ionos.com/domain-dns-settings/${d}`,
      home: 'ionos.com',
      path: `ionos.com → Sign In → Domain & SSL → ${apex} → DNS`,
      record: {
        edit: false, cols: ['Type', 'Host name', 'Points to'],
        lines: [
          'Click Add record, then CNAME (edit the www line instead if there is one).',
          { text: 'Host name', value: 'www' },
          'Points to - paste this in:', { text: 'Points to', copy: target },
          'Click Save.',
        ],
      },
      forward: {
        can: true, url: d => `https://my.ionos.com/domain-details/${d}`, httpsShortOk: true, labels: { to: 'Destination', type: 'HTTP redirect' },
        lines: [
          'Open your domain\'s Details and click Adjust Destination.',
          'Pick Domain Forwarding, then "arbitrary URL".',
          'Type:', { text: 'Destination', copy: full },
          'Leave "forward the www subdomain" un-ticked. Click Save.',
        ],
      },
      help: { dns: 'https://www.ionos.com/help/domains/configuring-cname-records-for-subdomains/configuring-a-cname-record-for-a-subdomain/', forward: 'https://www.ionos.com/help/domains/forwarding-a-domain/forwarding-a-domain-to-a-different-domain/' },
    },
    cloudflare: {
      name: 'Cloudflare',
      dnsUrl: d => `https://dash.cloudflare.com/?to=/:account/${d}/dns/records`,
      home: 'dash.cloudflare.com',
      path: `dash.cloudflare.com → Sign In → ${apex} → DNS → Records`,
      record: {
        edit: true, proxy: true, cols: ['Type', 'Name', 'Content'],
        lines: [
          'Is there a www line? Click Edit on it. If not, click Add record.',
          { text: 'Type', value: 'CNAME' },
          { text: 'Name', value: 'www' },
          'Target - paste this in:', { text: 'Target', copy: target },
          'Proxy status: switch it OFF - the cloud turns grey ("DNS only"). This one matters.',
          'Click Save.',
        ],
      },
      forward: {
        can: true, url: d => `https://dash.cloudflare.com/?to=/:account/${d}/rules/overview`, httpsShortOk: true, labels: { to: 'Target URL', type: '301' },
        lines: [
          'Need a line with Name @. None? Add record → Type A → Name @ → IPv4: 192.0.2.1 → Proxy ON (orange). Save.',
          'In the left menu click Rules, then Create rule → Redirect Rule.',
          'Pick the template "Redirect from Root to WWW".',
          'Check it goes to:', { text: 'Target URL', copy: full },
          'Status 301. Click Deploy.',
        ],
      },
      help: { dns: 'https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/', forward: 'https://developers.cloudflare.com/fundamentals/manage-domains/redirect-domain/' },
    },
    networksolutions: {
      name: 'Network Solutions',
      dnsUrl: null,
      home: 'networksolutions.com',
      path: `networksolutions.com → Sign In → Account Manager → Domains → ${apex} → DNS`,
      record: {
        edit: false, cols: ['Type', 'Host', 'Points to'],
        lines: [
          'Click + Add Record, then CNAME.',
          { text: 'Host / Alias', value: 'www' },
          'Points to - paste this in:', { text: 'Points to', copy: target },
          'Click Save.',
        ],
      },
      forward: {
        can: true, split: true, httpsShortOk: false, labels: { to: 'Destination', type: 'Permanent (301)' },
        note: 'Network Solutions charges a small fee for forwarding - it takes you to checkout the first time.',
        lines: [
          'Click Advanced Tools, then Add Web Forwarding.',
          'Pick https:// in the little box on the left.',
          'Type:', { text: 'Destination', copy: www },
          'Pick Permanent (301). Click Save.',
        ],
      },
      help: { dns: 'https://www.networksolutions.com/help/article/manage-dns-adns-records', forward: 'https://www.networksolutions.com/help/article/what-is-web-forwarding' },
    },
    porkbun: {
      name: 'Porkbun',
      dnsUrl: () => 'https://porkbun.com/account/domainsSpeedy',
      home: 'porkbun.com',
      path: `porkbun.com → Sign In → Account → Domain Management → ${apex} → Details → DNS Records`,
      record: {
        edit: false, cols: ['Type', 'Host', 'Answer'],
        lines: [
          `Next to ${apex}, click Details, then DNS Records (edit).`,
          'Delete any lines that point to "pixie.porkbun.com".',
          { text: 'Type', value: 'CNAME' },
          { text: 'Host', value: 'www' },
          'Answer - paste this in:', { text: 'Answer', copy: target },
          'Click Add.',
        ],
      },
      forward: {
        can: true, httpsShortOk: true, labels: { to: 'Forward to', type: 'Permanent (301)' },
        lines: [
          'In Details, click URL Forwarding (edit).',
          'Leave Host empty.',
          'Forward to:', { text: 'Forward to', copy: full },
          'Under advanced, pick Permanent (301). Click Submit.',
        ],
      },
      help: { dns: 'https://kb.porkbun.com/article/68-how-to-edit-dns-records', forward: 'https://kb.porkbun.com/article/39-how-to-set-up-url-forwarding' },
    },
    hostinger: {
      name: 'Hostinger',
      dnsUrl: () => 'https://hpanel.hostinger.com/domains',
      home: 'hpanel.hostinger.com',
      path: `hpanel.hostinger.com → Domains → Manage (next to ${apex}) → DNS / Nameservers`,
      record: {
        edit: true, cols: ['Type', 'Name', 'Target'],
        lines: [
          'Edit the www line, or add a record:',
          { text: 'Type', value: 'CNAME' },
          { text: 'Name', value: 'www' },
          'Target - paste this in:', { text: 'Target', copy: target },
          'Click Save / Add Record.',
        ],
      },
      forward: {
        can: true, httpsShortOk: false, labels: { to: 'Redirect to', type: 'Permanent (301)' },
        lines: [
          'On the same page, open the Redirects tab.',
          'Redirect to:', { text: 'Redirect to', copy: full },
          'Pick Permanent (301). Click Save.',
        ],
      },
      help: { dns: 'https://www.hostinger.com/support/1583249-how-to-manage-dns-records-at-hostinger/', forward: 'https://www.hostinger.com/support/3212384-how-to-redirect-a-domain-without-a-hosting-plan' },
    },
    other: {
      name: 'Somewhere else',
      dnsUrl: null,
      home: '',
      path: 'Sign in where you bought the domain and look for "DNS", "DNS records", "Zone editor" or "Advanced DNS".',
      record: {
        edit: true, cols: ['Type', 'Name', 'Value'],
        lines: [
          'If there\'s already a line named www, edit it. If not, add a new record:',
          { text: 'Type', value: 'CNAME' },
          { text: 'Name (or Host)', value: 'www' },
          'Value (or "Points to" / "Target") - paste this in:', T(target),
          'Save.',
        ],
      },
      forward: {
        can: true, httpsShortOk: false, labels: { to: 'Destination', type: 'Permanent (301)' },
        note: 'Shopify, Amazon Route 53, and Bluehost or HostGator accounts without a hosting plan can\'t forward - skip this step there and share the www address.',
        lines: [
          'Look for "Forwarding", "Redirect" or "URL redirect".',
          'Send it to:', { text: 'Destination', copy: full },
          'Pick Permanent (301). If there\'s an http:// or https:// choice, pick https://',
        ],
      },
      help: { dns: '' },
    },
  }
}

const ORDER: DomainProvider[] = ['godaddy', 'squarespace', 'namecheap', 'wix', 'ionos', 'cloudflare', 'networksolutions', 'porkbun', 'hostinger', 'other']

function CopyValue({ value, big = false }: { value: string; big?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <button type="button" onClick={() => copyText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1400) }).catch(() => {})}
      className={`inline-flex shrink-0 items-center gap-1 rounded-lg border font-black uppercase tracking-wide transition ${big ? 'px-3 py-1.5 text-[11px]' : 'px-2 py-1 text-[10px]'} ${done ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-500/40 dark:bg-emerald-500/10' : 'border-[#C9A24D]/50 bg-white text-[#8b7355] hover:border-[#C9A24D] dark:bg-white/[0.04] dark:text-[#e8c97a]'}`}>
      {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Copy className="h-3.5 w-3.5" />}{done ? 'Copied' : 'Copy'}
    </button>
  )
}

function Lines({ lines }: { lines: Line[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {lines.map((l, i) => typeof l === 'string' ? (
        <li key={i} className="flex gap-2 text-[13.5px] leading-snug text-[#111827] dark:text-white/85">
          <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C9A24D]" />{l}
        </li>
      ) : 'copy' in l ? (
        <li key={i} className="ml-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-xl border-2 border-dashed border-[#C9A24D]/50 bg-[#C9A24D]/[0.06] px-2.5 py-2 sm:ml-5">
          <code className="min-w-0 flex-[1_1_10rem] [overflow-wrap:anywhere] font-mono text-[13.5px] font-black text-[#111827] dark:text-white">{l.copy}</code>
          <CopyValue value={l.copy} big />
        </li>
      ) : (
        <li key={i} className="ml-1 flex items-baseline gap-2 text-[13.5px] sm:ml-5">
          <span className="font-semibold text-gray-500 dark:text-white/50">{l.text}:</span>
          <code className="font-mono font-black text-[#111827] dark:text-white">{l.value}</code>
        </li>
      ))}
    </ul>
  )
}

/** A simple drawing of the DNS list: the www line circled, its value changing to ours. */
function RecordSketch({ g, apex, target }: { g: Guide; apex: string; target: string }) {
  const [c1, c2, c3] = g.record.cols
  const row = 'grid grid-cols-[46px_40px_minmax(0,1fr)_24px] items-center gap-1.5 px-2 py-2 text-[10.5px] sm:grid-cols-[64px_70px_minmax(0,1fr)_28px] sm:gap-2 sm:px-3 sm:text-[11.5px]'
  return (
    <figure className="mt-3">
      <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm dark:border-white/15 dark:bg-[#1b1b1e]">
        <div className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-3 py-1.5 dark:border-white/10 dark:bg-white/[0.04]">
          <span className="h-2 w-2 rounded-full bg-gray-300" /><span className="h-2 w-2 rounded-full bg-gray-300" /><span className="h-2 w-2 rounded-full bg-gray-300" />
          <span className="ml-2 truncate text-[10px] font-bold text-gray-400">{g.name} · DNS · {apex}</span>
        </div>
        <div className={`${row} border-b border-gray-100 font-black uppercase tracking-wide text-gray-400 dark:border-white/10`} style={{ fontSize: 9.5 }}>
          <span>{c1}</span><span>{c2}</span><span>{c3}</span><span />
        </div>
        <div className={`${row} text-gray-300 dark:text-white/25`}><span>A</span><span>@</span><span className="truncate">(leave it)</span><span /></div>
        <div className={`${row} relative rounded-lg bg-[#C9A24D]/10 ring-2 ring-[#C9A24D]`}>
          <span className="font-black text-[#111827] dark:text-white">CNAME</span>
          <span className="font-black text-[#111827] dark:text-white">www</span>
          <span className="min-w-0">
            {g.record.edit && <span className="block truncate text-[10px] text-gray-400 line-through">@</span>}
            <span className="block truncate font-mono font-black text-[#8b6a2b] dark:text-[#e8c97a]">{target}</span>
          </span>
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#C9A24D] text-[#111827] shadow">{g.record.edit ? <Pencil className="h-3 w-3" /> : <Check className="h-3 w-3" strokeWidth={3} />}</span>
        </div>
        {g.record.proxy && (
          <div className="flex items-center justify-end gap-1.5 px-3 pb-2 text-[10px] font-black text-gray-500"><span className="h-2.5 w-4 rounded-full bg-gray-400" /> DNS only (grey)</div>
        )}
        <div className={`${row} text-gray-300 dark:text-white/25`}><span>MX</span><span>@</span><span className="truncate">(your email - leave it)</span><span /></div>
      </div>
      <figcaption className="mt-1 text-[10.5px] font-semibold text-gray-400">A simple drawing - {g.name}&apos;s screen may look a little different. Only the gold line changes.</figcaption>
    </figure>
  )
}

/** A simple drawing of the forwarding box: https:// picked, the www address, permanent. */
function ForwardSketch({ g, apex }: { g: Guide; apex: string }) {
  if (!g.forward.can) return null
  const f = g.forward
  return (
    <figure className="mt-3">
      <div className="space-y-2.5 rounded-xl border border-gray-300 bg-white p-3 shadow-sm dark:border-white/15 dark:bg-[#1b1b1e]">
        <p className="truncate text-[10px] font-black uppercase tracking-wide text-gray-400">Forward {apex}</p>
        <div>
          <p className="mb-1 text-[10.5px] font-bold text-gray-500">{f.labels.to}</p>
          <div className="flex gap-1.5">
            {f.split && (
              <span className="relative inline-flex items-center gap-1 rounded-lg bg-[#C9A24D]/10 px-2.5 py-1.5 font-mono text-[12px] font-black text-[#8b6a2b] ring-2 ring-[#C9A24D] dark:text-[#e8c97a]">
                https:// ▾
                <span className="absolute -bottom-5 left-0 whitespace-nowrap text-[9.5px] font-black text-[#C9A24D]">↑ pick https://</span>
              </span>
            )}
            <span className="min-w-0 flex-1 truncate rounded-lg border border-gray-300 px-2.5 py-1.5 font-mono text-[12px] font-bold text-[#111827] dark:border-white/15 dark:text-white">
              {f.split ? `www.${apex}` : `https://www.${apex}`}
            </span>
          </div>
        </div>
        <div className={`flex items-center gap-2 text-[11.5px] font-bold text-[#111827] dark:text-white ${f.split ? 'pt-3' : ''}`}>
          <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-[#C9A24D]"><span className="h-2 w-2 rounded-full bg-[#C9A24D]" /></span>
          {f.labels.type}
        </div>
      </div>
      <figcaption className="mt-1 text-[10.5px] font-semibold text-gray-400">A simple drawing - {g.name}&apos;s screen may look a little different.</figcaption>
    </figure>
  )
}

function OpenButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 py-3 text-center text-[13.5px] font-black text-white shadow-sm transition hover:bg-black dark:bg-white dark:text-[#111827] sm:inline-flex sm:w-auto">
      {label} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03] sm:p-4">
      <div className="flex items-start gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#C9A24D] to-[#e8c97a] text-[13px] font-black text-[#111827]">{n}</span>
        <p className="min-w-0 pt-0.5 text-[15px] font-black leading-snug text-[#111827] [overflow-wrap:anywhere] dark:text-white">{title}</p>
      </div>
      <div className="mt-1 pl-0.5">{children}</div>
    </li>
  )
}

export default function DomainSetupGuide({ hostname, target, pair }: { hostname: string; target: string; pair: boolean }) {
  const apex = hostname.replace(/^www\./, '')
  const [provider, setProvider] = useState<DomainProvider>('godaddy')
  const [detected, setDetected] = useState<DomainProvider | null>(null)
  useEffect(() => {
    let live = true
    let saved: DomainProvider | null = null
    try { saved = localStorage.getItem(`ohp-domain-provider:${apex}`) as DomainProvider | null } catch { /* private window */ }
    if (saved && ORDER.includes(saved)) setProvider(saved)
    // Where the domain really is (its nameservers) - opens on that company's steps.
    api.sites.getDomainProvider(apex).then(r => {
      const p = r.success ? r.data?.provider : null
      if (!live || !p) return
      const id = (ORDER.includes(p as DomainProvider) ? p : 'other') as DomainProvider
      setDetected(id)
      if (!saved) setProvider(id)
    })
    return () => { live = false }
  }, [apex])
  const pick = (p: DomainProvider) => { setProvider(p); try { localStorage.setItem(`ohp-domain-provider:${apex}`, p) } catch { /* ignore */ } }
  const g = guides(apex, target)[provider]
  const label = pair ? 'www' : hostname.split('.')[0]
  const forSupport = [
    `Please set up my domain ${apex}:`,
    `1. Add a CNAME record: name "${label}", value "${target}".`,
    ...(pair ? [`2. Forward ${apex} to https://www.${apex} (permanent 301 redirect, https - not http).`] : []),
  ].join('\n')

  return (
    <div className="mt-3 rounded-2xl border border-gray-200 bg-[#FAFAF7] p-2.5 dark:border-white/10 dark:bg-white/[0.03] sm:p-4">
      {detected && detected !== 'other' && (
        <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Sparkles className="h-3 w-3" /> Looks like {apex} is with {guides(apex, target)[detected].name}
        </p>
      )}
      <p className="text-[13px] font-black text-[#111827] dark:text-white">Where is {apex}?</p>
      <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Your domain company">
        {ORDER.map(id => (
          <button key={id} type="button" role="tab" aria-selected={provider === id} onClick={() => pick(id)}
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-black transition ${provider === id ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-[#C9A24D] dark:bg-white/[0.05] dark:text-white/70 dark:ring-white/10'}`}>
            {guides(apex, target)[id].name}
          </button>
        ))}
      </div>

      <ol className="mt-4 space-y-3">
        <Step n={1} title={`Open ${g.name === 'Somewhere else' ? 'your domain company\'s' : g.name + '\'s'} DNS page`}>
          {g.dnsUrl && <OpenButton href={g.dnsUrl(apex)} label={`Open my ${g.name} DNS page`} />}
          <p className="mt-2 text-[12.5px] leading-snug text-gray-600 [overflow-wrap:anywhere] dark:text-white/60">
            {g.dnsUrl ? 'Sign in if it asks. Didn\'t land on the DNS page? ' : ''}{g.path}
          </p>
        </Step>

        <Step n={2} title={pair ? 'Point "www" to your new website' : `Point "${label}" to your new website`}>
          <Lines lines={g.record.lines} />
          {g.record.note && <p className="mt-2 text-[12px] leading-snug text-gray-500 dark:text-white/50">{g.record.note}</p>}
          <RecordSketch g={g} apex={apex} target={target} />
        </Step>

        {pair && (
          <Step n={3} title={`Make ${apex} (without www) work too`}>
            {g.forward.can ? (
              <>
                {g.forward.note && <p className="mt-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[12px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{g.forward.note}</p>}
                {g.forward.url && <OpenButton href={g.forward.url(apex)} label={`Open ${g.name} forwarding`} />}
                <Lines lines={g.forward.lines} />
                <ForwardSketch g={g} apex={apex} />
                {!g.forward.httpsShortOk && (
                  <p className="mt-2 text-[12px] leading-snug text-gray-500 dark:text-white/50">Good to know: always share www.{apex} - it&apos;s the address that works everywhere.</p>
                )}
              </>
            ) : (
              <p className="mt-1 text-[13px] leading-snug text-[#111827] dark:text-white/85">{g.forward.why}</p>
            )}
          </Step>
        )}

        <Step n={pair ? 4 : 3} title="That's it - we'll take it from here">
          <p className="mt-1 text-[13px] leading-snug text-gray-600 dark:text-white/60">
            It usually works within an hour (sometimes up to a day). We check every few minutes, email you when it&apos;s live,
            and keep an eye on it - if anything&apos;s ever off, your Dash tells you exactly what to change.
          </p>
          {(g.help.dns || g.help.forward) && (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-black">
              {g.help.dns && <a href={g.help.dns} target="_blank" rel="noreferrer" className="text-[#8b7355] underline underline-offset-2 dark:text-[#e8c97a]">{g.name}&apos;s own guide with pictures: www step</a>}
              {g.help.forward && g.forward.can && <a href={g.help.forward} target="_blank" rel="noreferrer" className="text-[#8b7355] underline underline-offset-2 dark:text-[#e8c97a]">forwarding step</a>}
            </p>
          )}
        </Step>
      </ol>

      <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 dark:border-white/10">
        <p className="min-w-0 flex-1 text-[12px] font-semibold text-gray-500 dark:text-white/50">Stuck? Copy this and send it to {g.name === 'Somewhere else' ? 'your domain company' : `${g.name} support`} - they do this every day.</p>
        <CopyValue value={forSupport} />
      </div>
    </div>
  )
}
