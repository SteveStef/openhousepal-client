'use client'

// Admin > People > Offers: sign-up offers for presentations. Pick the plans and the percent off
// each, how long it lasts, the IDX fee, the free trial, how many people and the last day. You get a
// private link + QR code; people who sign up through it get exactly that deal at checkout
// (backend offer_service.py makes a PayPal plan for each, so it renews at the right price by itself).
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, CheckCircle2, Copy, Download, ExternalLink, Loader2, Pencil, Plus, Power, QrCode, Sparkles, Trash2, X } from 'lucide-react'
import api from '@/lib/api-service'
import type { AdminOffer, OfferDuration, OfferInput, OfferTier } from '@/types'
import ConfirmationModal from '@/components/ConfirmationModal'
import { copyText } from '@/lib/copyText'
import { styledQrSvgString } from '@/lib/qrStyle'
import { PRICING_PLANS } from '@/lib/pricing'
import { Box, FIELD, L, Stat } from './BrokerageGroupsPanel'
import { MoreMenu, Pill, type MenuItem } from './PaymentRequestsPanel'

const BRIGHT: OfferTier[] = ['BASIC', 'PREMIUM', 'IDX']
const NO_MLS: OfferTier[] = ['NO_MLS', 'PRO_NO_MLS']
const IDX_FEE = 500
const STATUS: Record<AdminOffer['status'], [string, string]> = {
  live: ['Live', 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'],
  full: ['All spots taken', 'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300'],
  ended: ['Ended', 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'],
  off: ['Off', 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'],
}
const usd = (n: number) => `$${n.toFixed(2)}`
const cut = (full: number, pct: number) => Math.round(full * (100 - pct)) / 100
const shortDay = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''

function lasts(d: OfferDuration, months?: number | null) {
  return d === 'first' ? 'first month' : d === 'months' ? `first ${months || 3} months` : 'every month'
}

export default function OffersPanel({ onToast }: { onToast: (message: string, type: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<AdminOffer[] | null>(null)
  const [open, setOpen] = useState<AdminOffer | 'new' | null>(null)
  const [qr, setQr] = useState<AdminOffer | null>(null)
  const [confirm, setConfirm] = useState<AdminOffer | null>(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const r = await api.admin.getOffers()
    if (r.success && r.data) setRows(r.data)
    else { setRows([]); onToast(r.error || "Couldn't load offers", 'error') }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const put = (o: AdminOffer) => setRows(prev => (prev || []).some(x => x.id === o.id) ? (prev || []).map(x => x.id === o.id ? o : x) : [o, ...(prev || [])])
  const list = rows || []
  const live = list.filter(o => o.status === 'live').length
  const spots = list.reduce((n, o) => n + o.uses, 0)
  const paid = list.reduce((n, o) => n + o.paid, 0)

  const toggle = async (o: AdminOffer) => {
    const r = await api.admin.updateOffer(o.id, { is_active: !o.is_active })
    if (r.success && r.data) { put(r.data); onToast(r.data.is_active ? 'Offer is on' : 'Offer is off - the link shows it has ended', 'success') }
    else onToast(r.error || "Couldn't change it", 'error')
  }
  const remove = async () => {
    if (!confirm) return
    setBusy(true)
    const r = await api.admin.deleteOffer(confirm.id)
    setBusy(false)
    if (r.success) { setRows(prev => (prev || []).filter(x => x.id !== confirm.id)); onToast('Offer deleted', 'success') }
    else onToast(r.error || "Couldn't delete it", 'error')
    setConfirm(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-[#111827] dark:text-white"><Sparkles className="h-5 w-5 text-[#C9A24D]" /> Sign-up offers</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500 dark:text-gray-400">
            A private offer page with a QR code - for a presentation or a team. Pick the plans and the deal; people who sign up through it get it at checkout.
          </p>
        </div>
        <button onClick={() => setOpen('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-black max-sm:w-full max-sm:justify-center max-sm:py-3 dark:bg-white dark:text-[#111827]">
          <Plus className="h-4 w-4" /> New offer
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Live offers" value={live} />
        <Stat label="Spots taken" value={spots} sub="Signed up through an offer" />
        <Stat label="Paid" value={paid} sub="Finished checkout" />
      </div>

      {rows === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-gray-200 px-6 py-16 text-center dark:border-gray-800">
          <Sparkles className="h-9 w-9 text-gray-300" />
          <p className="font-black text-gray-600 dark:text-gray-300">No offers yet</p>
          <p className="max-w-md text-sm font-semibold text-gray-400">Make one before a presentation - put the QR code on your last slide.</p>
          <button onClick={() => setOpen('new')} className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[#C9A24D] px-4 py-2 text-xs font-black text-white"><Plus className="h-4 w-4" /> New offer</button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map(o => {
            const [label, cls] = STATUS[o.status]
            const menu: MenuItem[] = [
              { label: 'Open the offer page', icon: ExternalLink, href: o.link },
              { label: 'Edit', icon: Pencil, onClick: () => setOpen(o) },
              { label: o.is_active ? 'Turn off' : 'Turn on', icon: Power, onClick: () => toggle(o) },
              ...(o.uses === 0 ? [{ label: 'Delete', icon: Trash2, onClick: () => setConfirm(o), danger: true }] : []),
            ]
            const pct = Math.min(100, Math.round(o.uses / o.max_uses * 100))
            return (
              <div key={o.id} className={`min-w-0 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm max-sm:p-4 dark:border-gray-800 dark:bg-[#151517] ${o.status === 'ended' || o.status === 'off' ? 'opacity-70' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-[15px] font-black leading-snug text-[#111827] dark:text-white">{o.name}</p>
                  <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${cls}`}>{label}</span>
                </div>
                {o.headline && <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">“{o.headline}”</p>}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {o.plans.map(p => <Pill key={p.tier}>{p.name}{p.percent_off ? ` · ${p.percent_off}% off` : ''}</Pill>)}
                  {o.waive_idx_fee && <Pill>IDX fee waived</Pill>}
                  <Pill>{o.trial ? `${o.trial_days}-day free trial` : 'No free trial'}</Pill>
                  {o.plans.some(p => p.percent_off) && <Pill>Discount: {lasts(o.duration, o.months)}</Pill>}
                </div>
                <div className="mt-3.5">
                  <div className="flex items-baseline justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
                    <span>{o.uses} of {o.max_uses} spots taken · {o.paid} paid</span>
                    <span>{o.expires_at ? `Last day ${shortDay(o.expires_at)}` : 'No end date'}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.08]"><div className="h-full rounded-full bg-[#C9A24D]" style={{ width: `${Math.max(pct, pct ? 3 : 0)}%` }} /></div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3.5 dark:border-white/[0.06]">
                  <button onClick={() => copyText(o.link).then(() => onToast('Offer link copied', 'success'))}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-black text-white max-sm:min-h-[42px] max-sm:flex-1 dark:bg-white dark:text-[#111827]"><Copy className="h-3.5 w-3.5" /> Copy link</button>
                  <button onClick={() => setQr(o)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-black text-gray-700 hover:border-[#C9A24D]/60 max-sm:min-h-[42px] max-sm:flex-1 dark:border-gray-700 dark:text-gray-200"><QrCode className="h-3.5 w-3.5" /> QR code</button>
                  <MoreMenu items={menu} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {open && <OfferDrawer key={open === 'new' ? 'new' : open.id} offer={open === 'new' ? null : open} onClose={() => setOpen(null)} onToast={onToast}
          onSaved={(o, created) => { put(o); setOpen(null); if (created) setQr(o) }} />}
      </AnimatePresence>
      <AnimatePresence>{qr && <QrModal offer={qr} onClose={() => setQr(null)} onToast={onToast} />}</AnimatePresence>
      <ConfirmationModal isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={remove} isLoading={busy}
        title={`Delete “${confirm?.name}”?`} message="Nobody has used it yet. The link and QR code stop working." confirmText="Delete" />
    </div>
  )
}

function QrModal({ offer, onClose, onToast }: { offer: AdminOffer; onClose: () => void; onToast: (m: string, t: 'success' | 'error') => void }) {
  const svg = useMemo(() => styledQrSvgString(offer.link, { margin: 2, light: '#ffffff' }), [offer.link])
  const src = svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : ''
  const download = () => {
    if (!src) return
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 1200
      const ctx = c.getContext('2d'); if (!ctx) return
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1200, 1200); ctx.drawImage(img, 0, 0, 1200, 1200)
      c.toBlob(b => {
        if (!b) return
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${offer.name.replace(/[^\w-]+/g, '-').slice(0, 40)}-offer-qr.png`
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      }, 'image/png')
    }
    img.src = src
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 max-sm:!m-0" onClick={onClose}>
      <motion.div initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-[1.75rem] bg-white p-6 text-center shadow-2xl dark:bg-[#151517]">
        <div className="flex items-start justify-between gap-3 text-left">
          <div><p className="text-[11px] font-black uppercase tracking-widest text-[#9a7a35] dark:text-[#e6c47c]">Offer ready</p><h3 className="mt-1 text-lg font-black leading-snug text-[#111827] dark:text-white">{offer.name}</h3></div>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>
        {src && <img src={src} alt="QR code for the offer" className="mx-auto mt-4 aspect-square w-60 max-w-full rounded-2xl border border-gray-100 bg-white p-2" />}
        <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Put this on your slide - phones open the offer page.</p>
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-[#faf9f7] p-2 pl-3 text-left dark:border-gray-700 dark:bg-black/30">
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-600 dark:text-gray-300">{offer.link}</span>
          <button onClick={() => copyText(offer.link).then(() => onToast('Offer link copied', 'success'))} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#111827] px-3 py-2 text-xs font-black text-white dark:bg-white dark:text-[#111827]"><Copy className="h-3.5 w-3.5" /> Copy</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={download} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-xs font-black text-gray-700 dark:border-gray-700 dark:text-gray-200"><Download className="h-3.5 w-3.5" /> Save QR image</button>
          <a href={offer.link} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2.5 text-xs font-black text-gray-700 dark:border-gray-700 dark:text-gray-200"><ExternalLink className="h-3.5 w-3.5" /> Open page</a>
        </div>
      </motion.div>
    </motion.div>
  )
}

function OfferDrawer({ offer, onClose, onSaved, onToast }: {
  offer: AdminOffer | null; onClose: () => void
  onSaved: (o: AdminOffer, created: boolean) => void
  onToast: (message: string, type: 'success' | 'error') => void
}) {
  const [name, setName] = useState(offer?.name || '')
  const [headline, setHeadline] = useState(offer?.headline || '')
  const [on, setOn] = useState<Partial<Record<OfferTier, string>>>(() => offer
    ? Object.fromEntries(offer.plans.map(p => [p.tier, String(p.percent_off)]))
    : { BASIC: '10', PREMIUM: '10', IDX: '10' })
  const [duration, setDuration] = useState<OfferDuration>(offer?.duration || 'forever')
  const [months, setMonths] = useState(String(offer?.months || 3))
  const [trial, setTrial] = useState(offer ? offer.trial : true)
  const [waive, setWaive] = useState(offer ? offer.waive_idx_fee : true)
  const [maxUses, setMaxUses] = useState(String(offer?.max_uses || 25))
  const [endsOn, setEndsOn] = useState(offer?.expires_at ? new Date(offer.expires_at).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : '')
  const [saving, setSaving] = useState(false)
  // The trial length the PayPal plans really get (server setting), not a guess.
  const [trialDays, setTrialDays] = useState(offer?.trial_days || 14)
  useEffect(() => { api.admin.offerSettings().then(r => { if (r.success && r.data) setTrialDays(r.data.trial_days) }) }, [])
  const tiers = Object.keys(on) as OfferTier[]
  const anyDiscount = tiers.some(t => Number(on[t]) > 0)

  const flip = (t: OfferTier) => setOn(p => { const n = { ...p }; if (t in n) delete n[t]; else n[t] = '10'; return n })
  const pctOf = (t: OfferTier) => Math.max(0, Math.min(90, Math.round(Number(on[t]) || 0)))

  const save = async () => {
    if (!name.trim()) { onToast('Give the offer a name (only you see it)', 'error'); return }
    if (!tiers.length) { onToast('Pick at least one plan', 'error'); return }
    if (tiers.some(t => !/^\d{1,2}$/.test(String(on[t] ?? '').trim()) || Number(on[t]) > 90)) { onToast('Percent off must be a whole number from 0 to 90', 'error'); return }
    const mu = Number(maxUses)
    if (!Number.isInteger(mu) || mu < 1) { onToast('Set how many people can use it', 'error'); return }
    if (duration === 'months' && (!Number.isInteger(Number(months)) || Number(months) < 2 || Number(months) > 24)) { onToast('Months must be 2 to 24', 'error'); return }
    const body: OfferInput = {
      name: name.trim(), headline: headline.trim() || null, max_uses: mu,
      percents: Object.fromEntries(tiers.map(t => [t, pctOf(t)])), duration, months: duration === 'months' ? Number(months) : null,
      trial, waive_idx_fee: 'IDX' in on ? waive : false,
      ...(endsOn ? { ends_on: endsOn } : offer?.expires_at ? { clear_end: true } : {}),
    }
    setSaving(true)
    const r = offer ? await api.admin.updateOffer(offer.id, body) : await api.admin.createOffer(body)
    setSaving(false)
    if (r.success && r.data) { onToast(offer ? 'Offer saved - same link' : 'Offer made', 'success'); onSaved(r.data, !offer) }
    else onToast(r.error || "Couldn't save it", 'error')
  }

  const Switch = ({ value, onChange, label, sub }: { value: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) => (
    <button type="button" onClick={() => onChange(!value)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 px-3.5 py-3 text-left dark:border-gray-700">
      <span><span className="block text-sm font-black text-[#111827] dark:text-white">{label}</span>{sub && <span className="block text-[11px] font-semibold text-gray-400">{sub}</span>}</span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${value ? 'bg-[#C9A24D]' : 'bg-gray-200 dark:bg-white/15'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} /></span>
    </button>
  )

  const PlanRow = ({ t }: { t: OfferTier }) => {
    const p = PRICING_PLANS[t]
    const picked = t in on
    const pct = pctOf(t)
    return (
      <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${picked ? 'border-[#C9A24D]/60 bg-[#C9A24D]/[0.06]' : 'border-gray-200 dark:border-gray-700'}`}>
        <button type="button" onClick={() => flip(t)} aria-pressed={picked} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${picked ? 'border-[#C9A24D] bg-[#C9A24D] text-white' : 'border-gray-300 dark:border-gray-600'}`}>{picked && <Check className="h-3.5 w-3.5" />}</span>
          <span className="min-w-0">
            <span className="block text-sm font-black text-[#111827] dark:text-white">{p.name}</span>
            <span className="block text-[11px] font-semibold text-gray-400">{picked && pct ? <>{usd(p.price)} → <b className="text-[#8b7355] dark:text-[#e8c97a]">{usd(cut(p.price, pct))}</b>/mo</> : `${usd(p.price)}/mo`}</span>
          </span>
        </button>
        {picked && (
          <label className="flex shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2 dark:border-gray-700 dark:bg-[#0B0B0B]">
            <input value={on[t] ?? ''} onChange={e => setOn(prev => ({ ...prev, [t]: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) }))} inputMode="numeric" aria-label={`${p.name} percent off`}
              className="w-9 bg-transparent py-1.5 text-right text-sm font-black text-[#111827] outline-none dark:text-white" />
            <span className="pl-0.5 text-xs font-black text-gray-400">% off</span>
          </label>
        )}
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex justify-end bg-black/50 max-sm:!m-0" onClick={onClose}>
      <motion.div initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        onClick={e => e.stopPropagation()} className="flex h-full w-full max-w-2xl flex-col bg-[#faf9f7] shadow-2xl dark:bg-[#0B0B0B]">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <button onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-black text-gray-500 hover:text-[#111827] dark:hover:text-white max-sm:min-h-[44px] max-sm:pr-3"><ArrowLeft className="h-4 w-4" /> Offers</button>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 max-sm:flex max-sm:h-11 max-sm:w-11 max-sm:items-center max-sm:justify-center max-sm:bg-gray-100 max-sm:text-gray-600 dark:max-sm:bg-white/10 dark:max-sm:text-gray-200"><X className="h-4 w-4 max-sm:h-5 max-sm:w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
          <h3 className="text-2xl font-black text-[#111827] dark:text-white">{offer ? 'Edit offer' : 'New offer'}</h3>
          {offer && offer.uses > 0 && <p className="rounded-xl bg-[#C9A24D]/10 px-3 py-2 text-xs font-bold text-[#8b7355] dark:text-[#e8c97a]">Changing the deal only affects people who sign up from now on - anyone who already paid keeps their price.</p>}

          <Box title="1 · Name it">
            <div className="grid gap-3">
              <L label="Name (only you see it) *"><input className={FIELD} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Line Realtors - Nov 18 meeting" /></L>
              <L label="Headline on their page (optional)"><input className={FIELD} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="e.g. Main Line Realtors exclusive" maxLength={140} /></L>
            </div>
          </Box>

          <Box title="2 · Plans and percent off">
            <p className="mb-2 text-[11px] font-black text-gray-500 dark:text-gray-400">Bright MLS agents</p>
            <div className="space-y-2">{BRIGHT.map(t => <div key={t}>{PlanRow({ t })}</div>)}</div>
            <p className="mb-2 mt-4 text-[11px] font-black text-gray-500 dark:text-gray-400">Agents outside Bright MLS</p>
            <div className="space-y-2">{NO_MLS.map(t => <div key={t}>{PlanRow({ t })}</div>)}</div>
            <p className="mt-2 text-[11px] font-semibold text-gray-400">Only the plans you tick show on the offer page. 0% is fine - for example just the fee waived or just the trial.</p>
          </Box>

          <Box title="3 · The deal">
            {anyDiscount && (
              <>
                <p className="mb-1.5 text-[11px] font-black text-gray-500 dark:text-gray-400">The discount lasts</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {([['first', 'First month'], ['months', 'A few months'], ['forever', 'Forever']] as [OfferDuration, string][]).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setDuration(k)} className={`rounded-xl border px-2 py-2.5 text-xs font-black transition ${duration === k ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]' : 'border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400'}`}>{l}</button>
                  ))}
                </div>
                {duration === 'months' && (
                  <L label="How many months" className="mt-3"><input className={FIELD} inputMode="numeric" value={months} onChange={e => setMonths(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} placeholder="3" /></L>
                )}
                <div className="h-3" />
              </>
            )}
            <div className="space-y-2">
              {'IDX' in on && Switch({ value: waive, onChange: setWaive, label: `Waive the $${IDX_FEE} IDX setup fee`, sub: waive ? 'IDX sign-ups pay no setup fee' : `IDX sign-ups pay the $${IDX_FEE} fee at sign-up` })}
              {Switch({ value: trial, onChange: setTrial, label: `${trialDays}-day free trial`, sub: trial ? 'Nothing to pay today - the first charge is after the trial' : 'They pay when they sign up' })}
            </div>
          </Box>

          <Box title="4 · Limits">
            <div className="grid gap-3 sm:grid-cols-2">
              <L label="How many people can use it *"><input className={FIELD} inputMode="numeric" value={maxUses} onChange={e => setMaxUses(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} placeholder="25" /></L>
              <L label="Last day (optional)"><input className={FIELD} type="date" value={endsOn} onChange={e => setEndsOn(e.target.value)} /></L>
            </div>
            <p className="mt-2 text-[11px] font-semibold text-gray-400">A spot is taken when someone signs up through the offer, so it can't be shared past this number. The link is private and hidden from Google.</p>
          </Box>

          {tiers.length > 0 && (
            <div className="rounded-2xl border border-[#C9A24D]/40 bg-white p-4 dark:bg-[#151517]">
              <p className="text-[11px] font-black uppercase tracking-widest text-[#9a7a35] dark:text-[#e6c47c]">What they'll get</p>
              <ul className="mt-2 space-y-1.5 text-sm font-semibold text-gray-700 dark:text-gray-200">
                {[...BRIGHT, ...NO_MLS].filter(t => t in on).map(t => {
                  const p = PRICING_PLANS[t]; const pct = pctOf(t)
                  const fee = t === 'IDX' ? (waive ? ` · no $${IDX_FEE} setup fee` : ` · $${IDX_FEE} setup fee`) : ''
                  return <li key={t}><b>{p.name}:</b> {pct ? <>{usd(cut(p.price, pct))}/mo {duration === 'forever' ? 'forever' : `for the ${lasts(duration, Number(months))}, then ${usd(p.price)}`}</> : <>{usd(p.price)}/mo</>}{fee}</li>
                })}
                <li className="text-gray-500 dark:text-gray-400">{trial ? `Starts with a ${trialDays}-day free trial.` : 'No free trial - they pay at sign-up.'}</li>
              </ul>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-2 border-t border-gray-200 bg-[#faf9f7]/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 dark:border-gray-800 dark:bg-[#0B0B0B]/95">
          <button onClick={save} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#111827] py-3 text-sm font-black text-white disabled:opacity-50 dark:bg-white dark:text-[#111827]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : offer ? <Check className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />} {offer ? 'Save offer' : 'Make the offer'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
