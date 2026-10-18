'use client'

import { useVisitor } from '@/lib/visitor'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Bell, Check, Heart, Loader2, X } from 'lucide-react'
import { formatCompactPrice } from './listingFormat'
import { openHousePalPublicUrl } from '@/lib/publicResourceLinks'

// "Save this search" and the heart on a home, on the IDX website. Instead of the full Showcase
// form (welcome page + a question per screen), a short window: (1) here's what we'll watch for -
// everything already filled in from the visitor's search or the home they liked - "Looks good",
// (2) name / email / phone (+ the one-tap "working with an agent?" the Showcase form always asks -
// a Showcase is never built for someone another agent represents), (3) done, with their
// Showcase link. It submits to the agent's real Showcase form (the site's showcase-creator
// doorway -> forms_service.submit_form), so the lead, the Showcase, its emails and the follow-up
// are exactly what the full form makes.
//
// Opened by SiteFormLauncher for any element with data-ohp-criteria (a SavedSearch as JSON).
export interface SavedSearch {
  kind?: 'search' | 'home'
  cities?: string[]
  q?: string
  area?: string
  min_price?: string | number
  max_price?: string | number
  min_beds?: string | number
  min_baths?: string | number
  types?: string[]
  min_sqft?: string | number
  max_sqft?: string | number
  min_acres?: string | number
  min_year_built?: string | number
  school_district?: string
  home?: { address?: string; photo?: string | null; price?: number | null }
}

const TYPE_LABEL: Record<string, string> = { single_family: 'Single family', town_house: 'Townhouse', condo: 'Condo', multi_family: 'Multi-family' }
const TYPE_ANSWER: Record<string, string> = { single_family: 'Single-family home', town_house: 'Condo/Townhouse', condo: 'Condo/Townhouse', multi_family: 'Multi-family' }
const NO_AGENT = "No, I'm not working with an agent"
const HAS_AGENT = 'Yes, I already have an agent'

const num = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v))
const money = (v: unknown) => { const n = num(v); return n ? formatCompactPrice(n) : null }

export function savedSearchChips(c: SavedSearch): { k: string; v: string }[] {
  const out: { k: string; v: string }[] = []
  if (c.area) out.push({ k: 'Where', v: 'The area you drew on the map' })
  else if (c.cities?.length) out.push({ k: 'Where', v: c.cities.length > 4 ? `${c.cities.slice(0, 4).join(', ')} +${c.cities.length - 4} more` : c.cities.join(', ') })
  const lo = money(c.min_price), hi = money(c.max_price)
  if (lo || hi) out.push({ k: 'Price', v: lo && hi ? `${lo} – ${hi}` : lo ? `${lo}+` : `Up to ${hi}` })
  if (num(c.min_beds)) out.push({ k: 'Beds', v: `${num(c.min_beds)}+` })
  if (num(c.min_baths)) out.push({ k: 'Baths', v: `${num(c.min_baths)}+` })
  if (c.types?.length) out.push({ k: 'Home type', v: c.types.map(t => TYPE_LABEL[t] || t).join(', ') })
  const s1 = num(c.min_sqft), s2 = num(c.max_sqft)
  if (s1 || s2) out.push({ k: 'Size', v: s1 && s2 ? `${s1.toLocaleString()} – ${s2.toLocaleString()} sq ft` : s1 ? `${s1.toLocaleString()}+ sq ft` : `Up to ${s2!.toLocaleString()} sq ft` })
  if (num(c.min_acres)) out.push({ k: 'Lot', v: `${num(c.min_acres)}+ acres` })
  if (num(c.min_year_built)) out.push({ k: 'Built', v: `${num(c.min_year_built)} or newer` })
  if (c.school_district) out.push({ k: 'Schools', v: c.school_district })
  if (c.q && !out.length) out.push({ k: 'Search', v: c.q })
  return out
}

function answersFor(c: SavedSearch, contact: { name: string; email: string; phone: string }) {
  const chips = savedSearchChips(c)
  const types = Array.from(new Set((c.types || []).map(t => TYPE_ANSWER[t]).filter(Boolean)))
  const a: { questionId: string; value: unknown }[] = [
    { questionId: 'has_agent', value: NO_AGENT },
    { questionId: 'full_name', value: contact.name.trim() },
    { questionId: 'email', value: contact.email.trim() },
    { questionId: 'phone', value: contact.phone.trim() },
    { questionId: 'cities', value: c.area ? [] : (c.cities || []) },
    { questionId: 'school_districts', value: c.school_district ? [c.school_district] : [] },
    { questionId: 'budget_min', value: num(c.min_price) ?? '' },
    { questionId: 'budget_max', value: num(c.max_price) ?? '' },
    { questionId: 'min_bedrooms', value: num(c.min_beds) ?? '' },
    { questionId: 'min_baths', value: num(c.min_baths) ?? '' },
    { questionId: 'min_sqft', value: num(c.min_sqft) ?? '' },
    { questionId: 'max_sqft', value: num(c.max_sqft) ?? '' },
    { questionId: 'min_acres', value: num(c.min_acres) ?? '' },
    { questionId: 'min_year_built', value: num(c.min_year_built) ?? '' },
    { questionId: 'home_type', value: types },
    { questionId: 'exact_home_types', value: (c.types || []).map(t => ({ single_family: 'is_single_family', town_house: 'is_town_house', condo: 'is_condo', multi_family: 'is_multi_family' } as Record<string, string>)[t]).filter(Boolean) },
    { questionId: 'saved_search', value: [c.q ? `Typed: "${c.q}"` : '', ...chips.map(x => `${x.k}: ${x.v}`)].filter(Boolean).join(' · ') },
  ]
  if (c.area) a.push({ questionId: 'search_area', value: c.area })
  if (c.home?.address) a.push({ questionId: 'property_of_interest', value: c.home.address })
  return a
}

export default function SaveSearchWindow({ siteId, criteria, onClose }: { siteId: string; criteria: SavedSearch | null; onClose: () => void }) {
  const [step, setStep] = useState<'review' | 'contact' | 'represented' | 'done'>('review')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  // Signed in with Google on this site (lib/visitor): their name + email are already filled in.
  const visitor = useVisitor()
  useEffect(() => {
    if (!visitor) return
    setName(n => n || visitor.name)
    setEmail(e => e || visitor.email)
  }, [visitor])
  const [phone, setPhone] = useState('')
  const [agent, setAgent] = useState<'' | 'no' | 'yes'>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showcaseUrl, setShowcaseUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!criteria) return
    setStep('review'); setError(''); setAgent(''); setShowcaseUrl(null)
    // A returning visitor on this device doesn't retype their details.
    try {
      const saved = JSON.parse(localStorage.getItem('ohp_visitor_contact') || 'null')
      if (saved) { setName(saved.name || ''); setEmail(saved.email || ''); setPhone(saved.phone || '') }
    } catch {}
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria])

  const chips = criteria ? savedSearchChips(criteria) : []
  const isHome = criteria?.kind === 'home'
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  const phoneOk = phone.replace(/\D/g, '').length >= 10
  const canSend = name.trim().length > 1 && emailOk && phoneOk && agent !== ''

  const send = async () => {
    if (!criteria || !canSend || busy) return
    if (agent === 'yes') { setStep('represented'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/website-showcase-creator?site_id=${encodeURIComponent(siteId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersFor(criteria, { name, email, phone }) }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.success === false) { setError(body?.detail || body?.message || 'Something went wrong. Please try again.'); return }
      try { localStorage.setItem('ohp_visitor_contact', JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() })) } catch {}
      setShowcaseUrl(body?.redirectUrl || body?.redirect_url ? openHousePalPublicUrl(body.redirectUrl || body.redirect_url) : null)
      setStep('done')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const ease = [0.16, 1, 0.3, 1] as const
  const field = 'w-full rounded-xl border px-4 py-3 text-[15px] font-semibold outline-none transition focus:border-[color:var(--site-accent)]'
  const fieldStyle = { borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-bg)', color: 'var(--site-ink)' }
  const primary = 'inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-black transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50'

  return (
    <AnimatePresence>
      {criteria && (
        <motion.div key="ss" className="fixed inset-0 z-[110] flex items-end justify-center bg-black/65 sm:items-center sm:p-6"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={isHome ? 'Get homes like this' : 'Save this search'}
            className="relative w-full max-w-md overflow-hidden rounded-t-[28px] shadow-2xl sm:rounded-[28px]"
            style={{ backgroundColor: 'var(--site-surface)', color: 'var(--site-ink)' }}
            initial={{ y: 40, opacity: 0, scale: 0.97 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.45, ease }} onClick={e => e.stopPropagation()}>
            <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full transition hover:scale-105" style={{ backgroundColor: 'var(--site-bg-alt)', color: 'var(--site-muted)' }}><X className="h-4 w-4" /></button>

            {/* progress */}
            {step !== 'done' && step !== 'represented' && (
              <div className="flex gap-1.5 px-6 pt-6">
                {['review', 'contact'].map((s, i) => (
                  <span key={s} className="h-1 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--site-line)' }}>
                    <motion.span className="block h-full rounded-full" style={{ backgroundColor: 'var(--site-accent)' }} initial={false}
                      animate={{ width: step === 'contact' || i === 0 ? '100%' : '0%' }} transition={{ duration: 0.5, ease }} />
                  </span>
                ))}
              </div>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {step === 'review' && (
                <motion.div key="review" className="p-6 pt-5" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35, ease }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.14)', color: 'var(--site-accent)' }}>
                    {isHome ? <Heart className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
                  </span>
                  <h2 className="ohp-site-heading mt-4 pr-10 text-2xl font-black leading-tight" style={{ color: 'var(--site-heading)' }}>
                    {isHome ? 'Get homes like this one first' : 'Get new homes that match - the moment they list'}
                  </h2>
                  <p className="mt-1.5 text-sm" style={{ color: 'var(--site-muted)' }}>We&apos;ll build your own private Showcase with these picks and send new matches as they hit the market.</p>
                  {isHome && criteria.home?.address && (
                    <div className="mt-4 flex items-center gap-3 rounded-2xl border p-2.5" style={{ borderColor: 'var(--site-line)' }}>
                      {criteria.home.photo && <span className="h-12 w-16 shrink-0 rounded-xl bg-cover bg-center" style={{ backgroundImage: `url(${criteria.home.photo})` }} />}
                      <span className="min-w-0 text-sm font-bold" style={{ color: 'var(--site-heading)' }}><span className="block truncate">{criteria.home.address}</span>{criteria.home.price ? <span className="text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>${criteria.home.price.toLocaleString()}</span> : null}</span>
                    </div>
                  )}
                  <ul className="mt-4 divide-y overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--site-line)' }}>
                    {(chips.length ? chips : [{ k: 'Where', v: 'Everywhere I cover' }]).map((c, i) => (
                      <motion.li key={c.k} className="flex items-center justify-between gap-4 px-4 py-3 text-sm" style={{ borderColor: 'var(--site-line)' }}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05, duration: 0.35, ease }}>
                        <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--site-faint)' }}>{c.k}</span>
                        <span className="flex min-w-0 items-center gap-2 text-right font-bold" style={{ color: 'var(--site-heading)' }}><span className="truncate">{c.v}</span><Check className="h-4 w-4 shrink-0" style={{ color: 'var(--site-accent)' }} /></span>
                      </motion.li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => setStep('contact')} className={`${primary} mt-5`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>Looks good <ArrowRight className="h-4 w-4" /></button>
                  {!isHome && <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-xs font-bold" style={{ color: 'var(--site-muted)' }}>Change my search first</button>}
                </motion.div>
              )}

              {step === 'contact' && (
                <motion.form key="contact" className="p-6 pt-5" onSubmit={e => { e.preventDefault(); send() }}
                  initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35, ease }}>
                  <h2 className="ohp-site-heading pr-10 text-2xl font-black leading-tight" style={{ color: 'var(--site-heading)' }}>Where should we send your matches?</h2>
                  <div className="mt-4 space-y-2.5">
                    <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoComplete="name" className={field} style={fieldStyle} />
                    <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" inputMode="email" className={field} style={fieldStyle} />
                    <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" type="tel" autoComplete="tel" inputMode="tel" className={field} style={fieldStyle} />
                  </div>
                  <p className="mt-4 text-xs font-bold" style={{ color: 'var(--site-ink-soft)' }}>Are you working with another agent?</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {([['no', 'No'], ['yes', 'Yes, I am']] as const).map(([v, label]) => (
                      <button key={v} type="button" onClick={() => setAgent(v)} className="rounded-xl border px-3 py-2.5 text-sm font-black transition"
                        style={agent === v ? { backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)', borderColor: 'transparent' } : { borderColor: 'var(--site-line-strong)', color: 'var(--site-heading)' }}>{label}</button>
                    ))}
                  </div>
                  {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
                  <button type="submit" disabled={!canSend || busy} className={`${primary} mt-5`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                    {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Building your Showcase</> : <>Create my Showcase <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <button type="button" onClick={() => setStep('review')} className="mt-2 w-full py-2 text-xs font-bold" style={{ color: 'var(--site-muted)' }}>Back</button>
                </motion.form>
              )}

              {step === 'represented' && (
                <motion.div key="rep" className="p-8 text-center" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  <p className="text-sm font-semibold leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>Since you&apos;re already working with an agent, we&apos;re not able to build you a Showcase - reach out to them directly for anything you need. Thanks for stopping by!</p>
                  <button type="button" onClick={onClose} className={`${primary} mt-6`} style={{ backgroundColor: 'var(--site-heading)', color: 'var(--site-bg)' }}>Close</button>
                </motion.div>
              )}

              {step === 'done' && (
                <motion.div key="done" className="p-8 text-center" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }}>
                  <motion.span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}>
                    <Check className="h-8 w-8" />
                  </motion.span>
                  <h2 className="ohp-site-heading mt-5 text-2xl font-black" style={{ color: 'var(--site-heading)' }}>Your Showcase is ready</h2>
                  <p className="mt-2 text-sm" style={{ color: 'var(--site-muted)' }}>We just emailed you the link. New homes that match land there - and in your inbox - as soon as they list.</p>
                  {showcaseUrl && (
                    <a href={showcaseUrl} target="_blank" rel="noopener" className={`${primary} mt-6`} style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>Open my Showcase <ArrowRight className="h-4 w-4" /></a>
                  )}
                  <button type="button" onClick={onClose} className="mt-2 w-full py-2 text-xs font-bold" style={{ color: 'var(--site-muted)' }}>Keep browsing</button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
