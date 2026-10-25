'use client'

// "Get a new domain" - search, pick, confirm your details, pay with PayPal (user, 10/20). We
// register it in the agent's name at Name.com and point it at their IDX website ourselves, so
// there's nothing to set up afterwards. Shown on the website builder's Domain tab, Settings > IDX
// Domain, and the setup flow's "Your web address" step. Backend: domain_purchase_service.py.
import { useEffect, useState } from 'react'
import { ArrowLeft, Check, Copy, Globe2, Loader2, Lock, Mail, RefreshCw, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import api from '@/lib/api-service'
import { copyText } from '@/lib/copyText'
import { DomainContact, DomainSearch, DomainShop, DomainOption, PurchasedDomain, US_STATES, money, prettyDate } from '@/lib/domainShop'
import DomainWarningSheet from './DomainWarningSheet'

const box = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'
const gold = 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-[#111827] shadow-md shadow-[#C9A24D]/30 transition hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none'

/** A domain that wraps before its ending on a phone ("janesmithrealestate" / ".com"), never mid-word at the end. */
function DomainName({ d }: { d: string }) {
  const i = d.indexOf('.')
  return i > 0 ? <>{d.slice(0, i)}<wbr />{d.slice(i)}</> : <>{d}</>
}

export function useDomainShop(enabled = true) {
  const [shop, setShop] = useState<DomainShop | null>(null)
  const load = () => api.sites.getDomainShop().then(r => { if (r.success && r.data) setShop(r.data) })
  useEffect(() => { if (enabled) load() }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps
  return { shop, reload: load }
}

function TextField({ label, value, onChange, placeholder, type = 'text', autoComplete, className = '' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoComplete?: string; className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/50">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} className={box} />
    </label>
  )
}

function OptionRow({ o, onPick }: { o: DomainOption; onPick: () => void }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3 transition ${o.exact ? 'border-emerald-300 bg-gradient-to-br from-white to-emerald-50 dark:border-emerald-500/30 dark:from-[#151517] dark:to-emerald-500/[0.07]' : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-[#151517]'}`}>
      <div className="min-w-0 flex-1">
        {o.exact && <p className="mb-0.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-300"><Sparkles className="h-3 w-3" /> It&apos;s available!</p>}
        <p className="font-mono text-[13.5px] font-bold text-[#111827] [overflow-wrap:anywhere] dark:text-white"><DomainName d={o.domain} /></p>
        <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-white/50">
          {money(o.price)} for the first year{o.renewal_price !== o.price ? `, then ${money(o.renewal_price)}/year` : ' · renews yearly'}
        </p>
      </div>
      <button type="button" onClick={onPick} className={gold}>Pick</button>
    </div>
  )
}

function Checkout({ option, shop, back, onBack }: { option: DomainOption; shop: DomainShop; back: string; onBack: () => void }) {
  const [c, setC] = useState<DomainContact>({
    firstName: shop.contact.firstName || '', lastName: shop.contact.lastName || '', address1: shop.contact.address1 || '', address2: '',
    city: '', state: '', zip: '', email: shop.contact.email || '', phone: shop.contact.phone || '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: keyof DomainContact) => (v: string) => setC(prev => ({ ...prev, [k]: v }))
  const pay = async () => {
    setBusy(true); setErr('')
    const r = await api.sites.buyDomain(option.domain, c, back)
    if (r.success && r.data?.approve_url) { window.location.href = r.data.approve_url; return }
    setBusy(false)
    setErr(r.error || 'Something went wrong - try again.')
  }
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-gray-500 hover:text-[#111827] dark:text-white/50 dark:hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Pick a different name
      </button>
      <div className="relative overflow-hidden rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fffdf8] via-[#fbf6ec] to-[#f4ead7] p-4 dark:border-white/10 dark:from-[#0b0f0e] dark:via-[#111827] dark:to-[#1d1810]">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b7355] dark:text-[#e8c97a]">Your new domain</p>
        <p className="mt-1 font-mono text-lg font-black text-[#111827] [overflow-wrap:anywhere] dark:text-white"><DomainName d={option.domain} /></p>
        <p className="mt-1 text-sm font-bold text-[#111827] dark:text-white">{money(option.price)} today <span className="font-semibold text-gray-500 dark:text-white/55">· then {money(option.renewal_price)} each year, automatically</span></p>
        <ul className="mt-3 space-y-1.5">
          {['We set it up for you - your website opens on it by itself', 'Secure padlock (https) included', 'Your home address stays private (hidden from public lookups)', 'Yours to keep - stop renewing or move it any time'].map(t => (
            <li key={t} className="flex items-start gap-2 text-[12px] font-semibold text-gray-600 dark:text-white/65">
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>{t}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-sm font-black text-[#111827] dark:text-white">Who owns it</p>
        <p className="mt-0.5 text-[12px] font-semibold text-gray-500 dark:text-white/55">Domains are registered in the owner&apos;s name - that&apos;s you. This stays private.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TextField label="First name" value={c.firstName} onChange={set('firstName')} autoComplete="given-name" />
          <TextField label="Last name" value={c.lastName} onChange={set('lastName')} autoComplete="family-name" />
          <TextField label="Street address" value={c.address1} onChange={set('address1')} autoComplete="address-line1" className="sm:col-span-2" placeholder="123 Main St" />
          <TextField label="Apt / suite (optional)" value={c.address2 || ''} onChange={set('address2')} autoComplete="address-line2" className="sm:col-span-2" />
          <TextField label="Town / city" value={c.city} onChange={set('city')} autoComplete="address-level2" />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-white/50">State</span>
              <select value={c.state} onChange={e => set('state')(e.target.value)} className={box} autoComplete="address-level1">
                <option value="">-</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <TextField label="Zip" value={c.zip} onChange={set('zip')} autoComplete="postal-code" />
          </div>
          <TextField label="Email" type="email" value={c.email} onChange={set('email')} autoComplete="email" />
          <TextField label="Phone" type="tel" value={c.phone} onChange={set('phone')} autoComplete="tel" />
        </div>
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 p-2.5 text-[12px] font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" /> You&apos;ll get one email from Name.com (our domain partner) asking you to confirm this email address. Click the link in it within 15 days, or the domain pauses - every domain company has to do this.
        </p>
      </div>

      {err && <p className="text-sm font-bold text-red-500">{err}</p>}
      <button type="button" onClick={pay} disabled={busy} className={`${gold} w-full py-3.5 text-sm`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Pay {money(option.price)} with PayPal
      </button>
      <p className="text-center text-[11px] font-semibold text-gray-400">You&apos;ll go to PayPal to pay, then come straight back here.{shop.test_mode ? ' (Test mode - no real money.)' : ''}</p>
    </div>
  )
}

/** The search + checkout. `back` = where PayPal sends them afterwards ('setup' | 'settings' | 'website'). */
export default function BuyDomain({ back = 'website', shop: given, suggestion = '' }: { back?: string; shop?: DomainShop | null; suggestion?: string }) {
  const own = useDomainShop(given === undefined)
  const shop = given !== undefined ? given : own.shop
  const [q, setQ] = useState(suggestion)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<DomainSearch | null>(null)
  const [err, setErr] = useState('')
  const [picked, setPicked] = useState<DomainOption | null>(null)

  if (!shop) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#C9A24D]" /></div>
  if (!shop.buy) {
    return (
      <div className="rounded-2xl border border-dashed border-[#C9A24D]/50 bg-[#fffdf8] p-3.5 dark:border-white/15 dark:bg-white/[0.02]">
        <p className="text-[12.5px] font-black text-[#111827] dark:text-white">Buying a domain here opens soon</p>
        <p className="mt-1 text-[12px] font-semibold leading-snug text-gray-500 dark:text-white/55">You&apos;ll be able to pick a name like <span className="font-mono font-bold text-[#111827] dark:text-white">janesmithhomes.com</span>, pay, and we&apos;ll set it all up for you.</p>
      </div>
    )
  }
  if (picked) return <Checkout option={picked} shop={shop} back={back} onBack={() => setPicked(null)} />

  const go = async () => {
    if (!q.trim()) return
    setBusy(true); setErr('')
    const r = await api.sites.searchDomains(q.trim())
    setBusy(false)
    if (r.success && r.data) setRes(r.data)
    else { setRes(null); setErr(r.error || 'The search didn’t work - try again.') }
  }
  const exactTaken = res?.exact && res.exact.state !== 'available'
  return (
    <div>
      <form onSubmit={e => { e.preventDefault(); go() }} className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#C9A24D]" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Try your name" className={`${box} pl-8 font-mono`} />
        </div>
        <button type="submit" aria-label="Search" disabled={busy || !q.trim()} className={gold}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}<span className="hidden sm:inline">Search</span>
        </button>
      </form>
      <p className="mt-2 text-[11px] font-semibold text-gray-400">Try your name (like &quot;jane smith&quot;) - we&apos;ll show what&apos;s free, with the price per year.</p>
      {err && <p className="mt-2 text-xs font-bold text-red-500">{err}</p>}
      {res && (
        <div className="mt-3 space-y-2">
          {exactTaken && res.exact && (
            <p className="flex items-center gap-1.5 rounded-xl bg-gray-50 px-3 py-2 text-[12px] font-semibold text-gray-500 dark:bg-white/[0.04] dark:text-white/55">
              <X className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              {res.exact.state === 'ending_not_sold'
                ? <>We don&apos;t sell that ending - here are close matches.</>
                : <><span className="font-mono font-bold">{res.exact.domain}</span>&nbsp;is taken - these are free:</>}
            </p>
          )}
          {res.results.length === 0 && <p className="text-[12px] font-semibold text-gray-500">Nothing free for that one - try adding your town or &quot;homes&quot;.</p>}
          {res.results.map(o => <OptionRow key={o.domain} o={o} onPick={() => setPicked(o)} />)}
        </div>
      )}
    </div>
  )
}

/** A domain they bought here - status, renewal, and the "stop renewing" / "move it" controls. */
export function PurchasedDomainCard({ p, onChanged }: { p: PurchasedDomain; onChanged: () => void }) {
  const [busy, setBusy] = useState('')
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [askStop, setAskStop] = useState(false)
  const stop = async () => {
    setBusy('stop'); setMsg('')
    const r = await api.sites.stopDomainRenewal(p.id)
    setBusy('')
    if (r.success) onChanged(); else setMsg(r.error || 'Try again.')
  }
  const move = async () => {
    setBusy('move'); setMsg('')
    const r = await api.sites.getDomainTransferCode(p.id)
    setBusy('')
    if (r.success && r.data) setCode(r.data.code); else setMsg(r.error || 'Try again.')
  }
  const resend = async () => {
    setBusy('resend')
    const r = await api.sites.resendDomainEmail(p.id)
    setBusy('')
    setMsg(r.success && r.data?.sent ? `Sent again to ${p.email}.` : 'Your email is already confirmed, or we couldn’t resend - contact support if you need help.')
  }
  const working = p.status === 'CHECKOUT' || p.status === 'REGISTERING'
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-[#151517]">
      <DomainWarningSheet open={askStop} onClose={() => setAskStop(false)} onConfirm={stop}
        title={`Stop renewing ${p.domain}?`} subtitle="Bought through OpenHousePal"
        points={[
          { text: <>It keeps working until <b>{prettyDate(p.expires_at)}</b>, then the domain ends - you won&apos;t be charged again.</>, tone: 'ok' },
          { text: <>After that, your website goes back to your free OpenHousePal address and new links use <b>openhousepal.com</b>.</> },
          { text: <>Links and QR codes you handed out with <b className="font-mono">{p.domain}</b> stop opening once it ends, and someone else could buy the name.</> },
          { text: <>Want to keep the name at another domain company instead? Get its transfer code here first (the move option on this card).</>, tone: 'ok' },
        ]}
        confirmLabel="Stop renewing" />
      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${p.status === 'ACTIVE' ? 'bg-[#C9A24D] text-white' : 'bg-[#FAFAF7] text-[#8b7355] dark:bg-white/[0.06] dark:text-[#e8c97a]'}`}>
          {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[13px] font-bold text-[#111827] [overflow-wrap:anywhere] dark:text-white"><DomainName d={p.domain} /></p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-white/55">
            {p.status === 'ACTIVE' && (p.auto_renew ? `Bought here · renews ${prettyDate(p.expires_at)} for ${money(p.renewal_price)}` : `Bought here · not renewing - ends ${prettyDate(p.expires_at)}`)}
            {working && 'Getting it ready - this takes a minute or two.'}
            {p.status === 'FAILED' && 'We couldn’t get this one - your payment was refunded.'}
            {p.status === 'EXPIRED' && `Ended ${prettyDate(p.expires_at)}.`}
            {p.status === 'TRANSFERRED' && 'Moved to another company.'}
          </p>
        </div>
      </div>
      {p.status === 'ACTIVE' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={resend} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-gray-700 dark:text-gray-300">
            {busy === 'resend' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />} Resend confirm email
          </button>
          <button type="button" onClick={move} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-600 transition hover:border-[#C9A24D] disabled:opacity-50 dark:border-gray-700 dark:text-gray-300">
            {busy === 'move' ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Move to another company
          </button>
          {p.auto_renew && (
            <button type="button" onClick={() => setAskStop(true)} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20">
              {busy === 'stop' ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />} Stop renewing
            </button>
          )}
        </div>
      )}
      {code && (
        <div className="mt-3 rounded-xl bg-[#FAFAF7] p-3 dark:bg-white/[0.04]">
          <p className="text-[12px] font-semibold text-gray-600 dark:text-white/65">Your domain is unlocked. Give this code to the new company when they ask for an &quot;authorization&quot; or &quot;EPP&quot; code:</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="min-w-0 flex-1 break-all rounded-lg bg-white px-2.5 py-1.5 font-mono text-[13px] font-bold dark:bg-black/30 dark:text-white">{code}</span>
            <button type="button" onClick={() => copyText(code)} title="Copy" className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 hover:border-[#C9A24D] dark:border-white/10 dark:bg-white/[0.04]"><Copy className="h-3.5 w-3.5" /></button>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-gray-400">Once it moves, turn off renewing here so you aren&apos;t charged twice.</p>
        </div>
      )}
      {msg && <p className="mt-2 text-[12px] font-semibold text-gray-500 dark:text-white/55">{msg}</p>}
      {p.status === 'ACTIVE' && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-gray-400"><ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-500" /> Registered in your name at Name.com - your address is kept private.</p>
      )}
    </div>
  )
}
