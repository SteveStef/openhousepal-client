'use client'

// "Build your Showcase" on the agent's IDX website (user, 10/18 - "one of the best features... it's
// extremely important"). A guided, animated flow in the site's own colours that a 5th grader could
// follow: where to look (around a home they love + how far, towns, or a school district - each drawn
// on a map), what the home needs (price, beds, baths, type), then who they are (already filled in if
// they signed in with Google). It submits to the agent's real Showcase form (the site's
// showcase-creator doorway -> forms_service.submit_form), so the lead, the Showcase, its emails and
// the agent's follow-up are exactly what every other Showcase gets. The same flow edits a Showcase
// ("Change my search"): their answers start filled in, and saving updates the one they have.
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Bath, BedDouble, Bell, Building2, Check, GraduationCap, Heart, Home, Loader2,
  MapPin, Search, Sparkles, X, type LucideIcon,
} from 'lucide-react'
import api, { resolveMediaUrl } from '@/lib/api-service'
import { saveVisitor, showcaseCodeOf, useVisitor, type SiteVisitor } from '@/lib/visitor'
import AreaPicksMap from '@/components/maps/AreaPicksMap'
import RadiusMap from './RadiusMap'

export interface BuilderCriteria {
  cities?: string[]
  school_districts?: string[]
  min_price?: number | null
  max_price?: number | null
  min_beds?: number | null
  min_baths?: number | null
  center_address?: string | null
  center_lat?: number | null
  center_lng?: number | null
  radius_miles?: number | null
  types?: string[]
}

type Where = 'home' | 'towns' | 'district'
type Step = 'intro' | 'where' | 'place' | 'needs' | 'you' | 'building' | 'represented'
interface PickedHome { address: string; street: string; place: string; lat: number; lng: number; price?: number | null; beds?: number | null; baths?: number | null; photo?: string | null }

const PRICES = [0, 100e3, 150e3, 200e3, 250e3, 300e3, 350e3, 400e3, 450e3, 500e3, 600e3, 700e3, 800e3, 900e3, 1e6, 1.25e6, 1.5e6, 1.75e6, 2e6, 2.5e6, 3e6, 4e6, 5e6, 7.5e6, 10e6]
const RADII = [0.5, 1, 2, 3, 5, 10]
const BEDS = [0, 1, 2, 3, 4, 5]
const BATHS = [0, 1, 1.5, 2, 3, 4]
const TYPES: { id: string; label: string; answer: string; flag: string; icon: LucideIcon }[] = [
  { id: 'single_family', label: 'House', answer: 'Single-family home', flag: 'is_single_family', icon: Home },
  { id: 'town_house', label: 'Townhome', answer: 'Condo/Townhouse', flag: 'is_town_house', icon: Building2 },
  { id: 'condo', label: 'Condo', answer: 'Condo/Townhouse', flag: 'is_condo', icon: Building2 },
  { id: 'multi_family', label: 'Multi-family', answer: 'Multi-family', flag: 'is_multi_family', icon: Building2 },
]
const NO_AGENT = "No, I'm not working with an agent"
const ease = [0.16, 1, 0.3, 1] as const

const money = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n % 1e6 ? (n % 1e5 ? 2 : 1) : 0).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1e3)}K`)
const nearestIdx = (v: number | null | undefined, fallback: number) => (v ? PRICES.reduce((b, p, i) => (Math.abs(p - v) < Math.abs(PRICES[b] - v) ? i : b), 0) : fallback)
const titleTown = (v: string) => v.split(',')[0].toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase())
const townKey = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim()

export default function ShowcaseBuilder({ siteId, basePrefix, accent, agent, areas, mode = 'create', initial, existingCode, serverVisitor, headingClass = '' }: {
  siteId: string
  basePrefix: string
  accent: string
  agent: { name?: string | null; photo_url?: string | null }
  areas: { name: string; state?: string | null; slug: string; photo?: string | null }[]
  mode?: 'create' | 'edit'
  initial?: BuilderCriteria | null
  /** They already have a Showcase (create mode): offer it first. */
  existingCode?: string | null
  serverVisitor?: SiteVisitor | null
  headingClass?: string
}) {
  const live = useVisitor()
  const visitor = live || serverVisitor || null
  const agentFirst = (agent.name || 'your agent').split(' ')[0]
  const first = visitor?.firstName || visitor?.name?.split(' ')[0] || ''

  const startWhere: Where | null = initial?.center_lat != null && initial?.radius_miles ? 'home' : initial?.school_districts?.length && !initial?.cities?.length ? 'district' : initial?.cities?.length ? 'towns' : null
  const [step, setStep] = useState<Step>(mode === 'edit' ? 'where' : 'intro')
  const [dir, setDir] = useState(1)
  const [where, setWhere] = useState<Where | null>(startWhere)
  const [home, setHome] = useState<PickedHome | null>(initial?.center_lat != null && initial?.center_lng != null
    ? { address: initial.center_address || 'Your home', street: (initial.center_address || 'Your home').split(',')[0], place: (initial.center_address || '').split(',').slice(1).join(',').trim(), lat: initial.center_lat, lng: initial.center_lng! }
    : null)
  const [radius, setRadius] = useState<number>(initial?.radius_miles || 2)
  const [likeThis, setLikeThis] = useState(mode === 'create')
  const [towns, setTowns] = useState<string[]>(initial?.cities || [])
  const [districts, setDistricts] = useState<string[]>(initial?.school_districts || [])
  const [lo, setLo] = useState(nearestIdx(initial?.min_price, 0))
  const [hi, setHi] = useState(nearestIdx(initial?.max_price, PRICES.length - 1))
  const [beds, setBeds] = useState<number>(initial?.min_beds || 0)
  const [baths, setBaths] = useState<number>(initial?.min_baths || 0)
  const [types, setTypes] = useState<string[]>(initial?.types || [])
  const [name, setName] = useState(visitor?.name || '')
  const [email, setEmail] = useState(visitor?.email || '')
  const [phone, setPhone] = useState('')
  const [hasAgent, setHasAgent] = useState<'' | 'no' | 'yes'>('')
  const [error, setError] = useState('')
  const [resultCode, setResultCode] = useState<string | null>(null)
  const [buildMsg, setBuildMsg] = useState(0)

  useEffect(() => {
    if (!visitor) return
    setName(n => n || visitor.name)
    setEmail(e => e || visitor.email)
  }, [visitor])
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ohp_visitor_contact') || 'null')
      if (saved) { setName(n => n || saved.name || ''); setEmail(e => e || saved.email || ''); setPhone(p => p || saved.phone || '') }
    } catch { /* private mode */ }
  }, [])

  const steps: Step[] = ['where', 'place', 'needs', 'you']
  const at = steps.indexOf(step)
  const go = (s: Step, d = 1) => { setDir(d); setError(''); setStep(s); if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' }) }

  // "Find homes like this one": the home's price (give or take a quarter) and its bedrooms.
  const pickHome = (h: PickedHome, like = likeThis) => {
    setHome(h)
    // Only a home's sale price means anything here (a rental's monthly rent would set "up to $0").
    if (like && h.price && h.price >= 50_000) {
      const a = nearestIdx(h.price * 0.75, 0)
      setLo(a); setHi(Math.max(a + 1, nearestIdx(h.price * 1.25, PRICES.length - 1)))
    }
    if (like && h.beds) setBeds(Math.min(5, Math.max(1, h.beds - 1)))
  }

  const placeReady = where === 'home' ? !!home : where === 'towns' ? towns.length > 0 : where === 'district' ? districts.length > 0 : false
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
  const phoneOk = phone.replace(/\D/g, '').length >= 10
  const youReady = name.trim().length > 1 && emailOk && phoneOk && hasAgent !== ''

  const summary = useMemo(() => {
    const out: { k: string; v: string }[] = []
    if (where === 'home' && home) out.push({ k: 'Where', v: `Within ${radius} mi of ${home.street}` })
    if (where === 'towns' && towns.length) out.push({ k: 'Where', v: towns.map(titleTown).join(', ') })
    if (where === 'district' && districts.length) out.push({ k: 'Schools', v: districts.map(titleTown).join(', ') })
    if (lo > 0 || hi < PRICES.length - 1) out.push({ k: 'Price', v: lo > 0 && hi < PRICES.length - 1 ? `${money(PRICES[lo])} – ${money(PRICES[hi])}` : lo > 0 ? `${money(PRICES[lo])}+` : `Up to ${money(PRICES[hi])}` })
    if (beds) out.push({ k: 'Beds', v: `${beds}+` })
    if (baths) out.push({ k: 'Baths', v: `${baths}+` })
    if (types.length) out.push({ k: 'Type', v: types.map(t => TYPES.find(x => x.id === t)?.label || t).join(', ') })
    return out
  }, [where, home, radius, towns, districts, lo, hi, beds, baths, types])

  const submit = async () => {
    if (!youReady) return
    if (hasAgent === 'yes') { go('represented'); return }
    go('building'); setBuildMsg(0)
    const typeAnswers = Array.from(new Set(types.map(t => TYPES.find(x => x.id === t)!.answer)))
    const answers: { questionId: string; value: unknown }[] = [
      { questionId: 'has_agent', value: NO_AGENT },
      // which kind of search this is - the backend drops the other kinds' old settings
      { questionId: 'search_mode', value: where || '' },
      { questionId: 'full_name', value: name.trim() },
      { questionId: 'email', value: email.trim() },
      { questionId: 'phone', value: phone.trim() },
      { questionId: 'cities', value: where === 'towns' ? towns : [] },
      { questionId: 'school_districts', value: where === 'district' ? districts : [] },
      { questionId: 'budget_min', value: lo > 0 ? PRICES[lo] : '' },
      { questionId: 'budget_max', value: hi < PRICES.length - 1 ? PRICES[hi] : '' },
      { questionId: 'min_bedrooms', value: beds || '' },
      { questionId: 'min_baths', value: baths || '' },
      { questionId: 'home_type', value: typeAnswers },
      { questionId: 'exact_home_types', value: types.map(t => TYPES.find(x => x.id === t)!.flag) },
      { questionId: 'saved_search', value: `Built on the website${mode === 'edit' ? ' (changed their search)' : ''} · ${summary.map(x => `${x.k}: ${x.v}`).join(' · ')}` },
    ]
    if (where === 'home' && home) {
      answers.push({ questionId: 'center_address', value: home.address }, { questionId: 'center_lat', value: home.lat }, { questionId: 'center_lng', value: home.lng },
        { questionId: 'radius_miles', value: radius }, { questionId: 'property_of_interest', value: home.address })
    }
    const started = Date.now()
    try {
      const res = await fetch(`/api/website-showcase-creator?site_id=${encodeURIComponent(siteId)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answers }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || body?.success === false) throw new Error(body?.detail || body?.message || 'Something went wrong. Please try again.')
      const code = showcaseCodeOf(body?.redirectUrl || body?.redirect_url) || existingCode || null
      try { localStorage.setItem('ohp_visitor_contact', JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() })) } catch { /* private mode */ }
      saveVisitor({ name: name.trim(), email: email.trim(), ...(code ? { showcase: code } : {}) })
      // Let the little "building" moment play out before the reveal.
      await new Promise(r => setTimeout(r, Math.max(0, 2600 - (Date.now() - started))))
      setResultCode(code || 'ok')
    } catch (e: any) {
      setDir(-1); setStep('you'); setError(e?.message || 'Something went wrong. Please try again.')
    }
  }

  // The building messages cycle while it works.
  useEffect(() => {
    if (step !== 'building' || resultCode) return
    const t = window.setInterval(() => setBuildMsg(i => i + 1), 900)
    return () => window.clearInterval(t)
  }, [step, resultCode])

  const card = 'relative w-full overflow-hidden rounded-[28px] border shadow-[0_40px_90px_-50px_rgba(15,23,42,.55)]'
  const cardStyle = { backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)', color: 'var(--site-ink)' }
  const primaryBtn = 'inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-black shadow-[0_18px_34px_-16px_rgba(var(--site-accent-rgb),.9)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none'
  const primaryStyle = { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }
  const H = ({ children }: { children: React.ReactNode }) => <h2 className={`text-[28px] font-black leading-[1.08] tracking-tight sm:text-[34px] ${headingClass}`} style={{ color: 'var(--site-heading)' }}>{children}</h2>
  const Explain = ({ children }: { children: React.ReactNode }) => <p className="mt-2 text-[15px] leading-relaxed" style={{ color: 'var(--site-muted)' }}>{children}</p>

  const slide = { initial: (d: number) => ({ opacity: 0, x: d * 36 }), animate: { opacity: 1, x: 0 }, exit: (d: number) => ({ opacity: 0, x: d * -36 }) }

  return (
    <section className="relative isolate min-h-[calc(100dvh-5rem)] overflow-hidden px-4 pb-24 pt-8 sm:px-6 sm:pt-12">
      <style>{BUILDER_CSS}</style>
      {/* glow behind the card - soft colour, no blur filters (cheap to paint on phones) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="sb-orb sb-orb-a" /><div className="sb-orb sb-orb-b" />
      </div>

      <div className="mx-auto w-full max-w-2xl">
        {/* progress */}
        {at >= 0 && (
          <div className="mb-5 flex items-center gap-3">
            <button type="button" onClick={() => go(at === 0 ? (mode === 'edit' ? 'where' : 'intro') : steps[at - 1], -1)} disabled={at === 0 && mode === 'edit'}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition hover:-translate-x-0.5 disabled:opacity-0" style={{ borderColor: 'var(--site-line)', color: 'var(--site-muted)' }} aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-1 gap-1.5">
              {steps.map((s, i) => (
                <span key={s} className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--site-line)' }}>
                  <motion.span className="block h-full rounded-full" style={{ backgroundColor: 'var(--site-accent)' }} initial={false} animate={{ width: i <= at ? '100%' : '0%' }} transition={{ duration: 0.5, ease }} />
                </span>
              ))}
            </div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--site-faint)' }}>{at + 1} / {steps.length}</span>
          </div>
        )}

        <AnimatePresence mode="wait" custom={dir} initial={false}>
          {/* ---------------- intro ---------------- */}
          {step === 'intro' && (
            <motion.div key="intro" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4, ease }} className={`${card} p-6 sm:p-10`} style={cardStyle}>
              <div className="flex items-center gap-3">
                {agent.photo_url && <img src={resolveMediaUrl(agent.photo_url) || agent.photo_url} alt="" className="h-11 w-11 rounded-full object-cover ring-2" style={{ ['--tw-ring-color' as any]: 'var(--site-accent)' }} />}
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em]" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.12)', color: 'var(--site-accent-text)' }}>
                  <Sparkles className="h-3.5 w-3.5" /> Free · about a minute
                </span>
              </div>
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.6, ease }} className="mt-6">
                <H>{first ? `${first}, let's build your Showcase` : "Let's build your Showcase"}</H>
                <Explain>
                  A Showcase is <b style={{ color: 'var(--site-heading)' }}>your own private page of homes</b>. Tell us what you like one time. We&apos;ll keep it filled with homes that fit,
                  and let you know the moment a new one comes on the market. You can change it anytime.
                </Explain>
              </motion.div>
              <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                {[
                  { icon: Heart, t: 'Only homes that fit you', s: 'No scrolling past ones you’d never buy.' },
                  { icon: Bell, t: 'New homes first', s: 'The minute one lists, it’s on your page.' },
                  { icon: MapPin, t: `${agentFirst} on your side`, s: 'Questions or a tour - one tap away.' },
                ].map((b, i) => (
                  <motion.div key={b.t} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + i * 0.08, duration: 0.5, ease }}
                    className="rounded-2xl p-4" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                    <b.icon className="h-5 w-5" style={{ color: 'var(--site-accent)' }} />
                    <p className="mt-2 text-sm font-black" style={{ color: 'var(--site-heading)' }}>{b.t}</p>
                    <p className="mt-0.5 text-[12.5px] leading-snug" style={{ color: 'var(--site-muted)' }}>{b.s}</p>
                  </motion.div>
                ))}
              </div>
              {existingCode && (
                <a href={`${basePrefix}/my-showcase`} className="mt-5 flex items-center justify-between gap-3 rounded-2xl border p-4 text-sm font-bold transition hover:-translate-y-0.5" style={{ borderColor: 'var(--site-accent)', color: 'var(--site-heading)' }}>
                  <span><Sparkles className="mr-1.5 inline h-4 w-4 align-[-3px]" style={{ color: 'var(--site-accent)' }} />You already have a Showcase - open it</span><ArrowRight className="h-4 w-4" />
                </a>
              )}
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => go('where')} className={`${primaryBtn} sb-shine`} style={primaryStyle}>Let&apos;s start <ArrowRight className="h-4 w-4" /></button>
                <span className="text-xs font-semibold" style={{ color: 'var(--site-faint)' }}>4 quick steps</span>
              </div>
            </motion.div>
          )}

          {/* ---------------- where ---------------- */}
          {step === 'where' && (
            <motion.div key="where" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4, ease }} className={`${card} p-6 sm:p-9`} style={cardStyle}>
              <H>{mode === 'edit' ? 'Change where we look' : 'Where should we look?'}</H>
              <Explain>Pick the one that sounds most like you. You can change it later.</Explain>
              <div className="mt-6 space-y-3">
                {([
                  { id: 'home', icon: Heart, t: 'Around a home I love', s: 'Pick a home you like. We draw a circle around it and show you the homes inside the circle.' },
                  { id: 'towns', icon: MapPin, t: 'In towns I choose', s: 'Pick one town or a few. You’ll see homes for sale in those towns.' },
                  { id: 'district', icon: GraduationCap, t: 'In a school district', s: 'Only homes where the kids would go to that district’s schools.' },
                ] as { id: Where; icon: LucideIcon; t: string; s: string }[]).map((o, i) => {
                  const on = where === o.id
                  return (
                    <motion.button key={o.id} type="button" onClick={() => setWhere(o.id)} whileTap={{ scale: 0.985 }}
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + i * 0.07, duration: 0.45, ease }}
                      className={`relative flex w-full items-start gap-4 rounded-2xl border-2 p-4 text-left transition-colors sm:p-5 ${on ? 'sb-picked' : ''}`}
                      style={{ borderColor: on ? 'var(--site-accent)' : 'var(--site-line)', backgroundColor: on ? 'rgba(var(--site-accent-rgb),.06)' : 'transparent' }}>
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors" style={on ? { backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' } : { backgroundColor: 'var(--site-bg-alt)', color: 'var(--site-accent)' }}>
                        <o.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[17px] font-black" style={{ color: 'var(--site-heading)' }}>{o.t}</span>
                        <span className="mt-0.5 block text-[13.5px] leading-snug" style={{ color: 'var(--site-muted)' }}>{o.s}</span>
                      </span>
                      <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition" style={{ borderColor: on ? 'var(--site-accent)' : 'var(--site-line-strong)', backgroundColor: on ? 'var(--site-accent)' : 'transparent' }}>
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: 'var(--site-on-accent)' }} />}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
              <div className="mt-7 flex justify-end">
                <button type="button" disabled={!where} onClick={() => go('place')} className={primaryBtn} style={primaryStyle}>Next <ArrowRight className="h-4 w-4" /></button>
              </div>
            </motion.div>
          )}

          {/* ---------------- place ---------------- */}
          {step === 'place' && (
            <motion.div key="place" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4, ease }} className={`${card} p-6 sm:p-9`} style={cardStyle}>
              {where === 'home' && (
                <>
                  <H>Which home do you love?</H>
                  <Explain>Type its address. It doesn&apos;t have to be for sale - it&apos;s just the middle of your circle.</Explain>
                  <HomeSearch picked={home} onPick={pickHome} onClear={() => setHome(null)} />
                  <AnimatePresence initial={false}>
                    {home && (
                      <motion.div key="radius" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.45, ease }} className="overflow-hidden">
                        <p className="mt-6 text-sm font-black" style={{ color: 'var(--site-heading)' }}>How far from it?</p>
                        <p className="text-[13px]" style={{ color: 'var(--site-muted)' }}>A bigger circle shows more homes. 1 mile is about a 20-minute walk.</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {RADII.map(r => {
                            const on = radius === r
                            return (
                              <button key={r} type="button" onClick={() => setRadius(r)} className="relative rounded-full border px-4 py-2 text-sm font-black transition" style={{ borderColor: on ? 'transparent' : 'var(--site-line-strong)', color: on ? 'var(--site-on-accent)' : 'var(--site-ink)' }}>
                                {on && <motion.span layoutId="sb-radius" className="absolute inset-0 rounded-full" style={{ backgroundColor: 'var(--site-accent)' }} transition={{ type: 'spring', stiffness: 460, damping: 34 }} />}
                                <span className="relative">{r < 1 ? '½' : r} mi</span>
                              </button>
                            )
                          })}
                        </div>
                        <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--site-line)' }}>
                          <RadiusMap lat={home.lat} lng={home.lng} miles={radius} accent={accent} className="h-60 w-full sm:h-72" />
                        </div>
                        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl p-3.5" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                          <input type="checkbox" checked={likeThis} onChange={e => { setLikeThis(e.target.checked); if (e.target.checked && home) pickHome(home, true) }} className="mt-0.5 h-4 w-4" style={{ accentColor: accent }} />
                          <span className="text-[13.5px] leading-snug" style={{ color: 'var(--site-ink)' }}><b>Also look for homes like this one</b> - a similar price and size. You&apos;ll see it on the next step.</span>
                        </label>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
              {where === 'towns' && (
                <>
                  <H>Which towns?</H>
                  <Explain>Tap every town you&apos;d be happy living in. You can pick more than one.</Explain>
                  {areas.length > 0 && (
                    <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {areas.slice(0, 12).map((a, i) => {
                        const label = `${a.name}${a.state ? `, ${a.state}` : ''}`
                        const on = towns.some(t => townKey(t) === townKey(label))
                        return (
                          <motion.button key={a.slug} type="button" whileTap={{ scale: 0.97 }} onClick={() => setTowns(ts => on ? ts.filter(t => townKey(t) !== townKey(label)) : [...ts, label])}
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.4, ease }}
                            className="relative h-24 overflow-hidden rounded-2xl border-2 text-left sm:h-28" style={{ borderColor: on ? 'var(--site-accent)' : 'transparent' }}>
                            {a.photo ? <img src={resolveMediaUrl(a.photo) || a.photo} alt="" className={`absolute inset-0 h-full w-full object-cover transition duration-700 ${on ? 'scale-110' : ''}`} /> : <span className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(var(--site-accent-rgb),.5), rgba(var(--site-primary-rgb),.9))' }} />}
                            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                            <span className="absolute bottom-2.5 left-3 right-9 text-[15px] font-black leading-tight text-white">{a.name}</span>
                            <span className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white/80 transition" style={{ backgroundColor: on ? 'var(--site-accent)' : 'rgba(0,0,0,.25)', borderColor: on ? 'var(--site-accent)' : 'rgba(255,255,255,.8)' }}>
                              {on && <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: 'var(--site-on-accent)' }} />}
                            </span>
                          </motion.button>
                        )
                      })}
                    </div>
                  )}
                  <LookupAdd placeholder="Add another town…" lookup={q => api.properties.citiesPublic(q)} picked={towns} onAdd={v => setTowns(ts => ts.some(t => townKey(t) === townKey(v)) ? ts : [...ts, v])} />
                  <Picked items={towns} onRemove={v => setTowns(ts => ts.filter(t => t !== v))} />
                  <div className="mt-4"><AreaPicksMap cities={towns} schoolDistricts={[]} accent={accent} className="h-56 sm:h-64" /></div>
                </>
              )}
              {where === 'district' && (
                <>
                  <H>Which school district?</H>
                  <Explain>Type the district&apos;s name. You&apos;ll only see homes where the kids would go to its schools.</Explain>
                  <LookupAdd placeholder="Search school districts…" lookup={q => api.properties.schoolDistrictsPublic(q)} picked={districts} onAdd={v => setDistricts(ds => ds.includes(v) ? ds : [...ds, v])} autoFocus />
                  <Picked items={districts} onRemove={v => setDistricts(ds => ds.filter(d => d !== v))} />
                  <div className="mt-4"><AreaPicksMap cities={[]} schoolDistricts={districts} accent={accent} className="h-56 sm:h-64" /></div>
                </>
              )}
              <div className="mt-7 flex justify-end">
                <button type="button" disabled={!placeReady} onClick={() => go('needs')} className={primaryBtn} style={primaryStyle}>Next <ArrowRight className="h-4 w-4" /></button>
              </div>
            </motion.div>
          )}

          {/* ---------------- needs ---------------- */}
          {step === 'needs' && (
            <motion.div key="needs" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4, ease }} className={`${card} p-6 sm:p-9`} style={cardStyle}>
              <H>What does your next home need?</H>
              <Explain>{where === 'home' && likeThis && home ? <>We started with what <b style={{ color: 'var(--site-heading)' }}>{home.street}</b> has. Change anything you like.</> : 'Leave anything you don’t mind about on “Any”.'}</Explain>

              <div className="mt-7">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-black" style={{ color: 'var(--site-heading)' }}>Price</p>
                  <motion.p key={`${lo}-${hi}`} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-lg font-black tabular-nums" style={{ color: 'var(--site-accent-text)' }}>
                    {lo === 0 && hi === PRICES.length - 1 ? 'Any price' : `${lo === 0 ? 'Up to' : money(PRICES[lo])}${lo > 0 && hi < PRICES.length - 1 ? ' – ' : hi < PRICES.length - 1 ? ' ' : '+'}${hi < PRICES.length - 1 ? money(PRICES[hi]) : ''}`}
                  </motion.p>
                </div>
                <PriceRange lo={lo} hi={hi} max={PRICES.length - 1} onChange={(a, b) => { setLo(a); setHi(b) }} />
              </div>

              <Choice label="Bedrooms" icon={BedDouble} values={BEDS} value={beds} onChange={setBeds} id="beds" fmt={v => (v ? `${v}+` : 'Any')} />
              <Choice label="Bathrooms" icon={Bath} values={BATHS} value={baths} onChange={setBaths} id="baths" fmt={v => (v ? `${v}+` : 'Any')} />

              <div className="mt-7">
                <p className="text-sm font-black" style={{ color: 'var(--site-heading)' }}>Kind of home <span className="font-semibold" style={{ color: 'var(--site-faint)' }}>(pick none for all)</span></p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {TYPES.map(t => {
                    const on = types.includes(t.id)
                    return (
                      <motion.button key={t.id} type="button" whileTap={{ scale: 0.95 }} onClick={() => setTypes(ts => on ? ts.filter(x => x !== t.id) : [...ts, t.id])}
                        className="inline-flex items-center gap-2 rounded-full border-2 px-4 py-2.5 text-sm font-black transition-colors"
                        style={on ? { borderColor: 'var(--site-accent)', backgroundColor: 'rgba(var(--site-accent-rgb),.1)', color: 'var(--site-heading)' } : { borderColor: 'var(--site-line)', color: 'var(--site-ink)' }}>
                        <t.icon className="h-4 w-4" style={{ color: on ? 'var(--site-accent)' : 'var(--site-faint)' }} /> {t.label}
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: 'var(--site-accent)' }} />}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <button type="button" onClick={() => go('you')} className={primaryBtn} style={primaryStyle}>Next <ArrowRight className="h-4 w-4" /></button>
              </div>
            </motion.div>
          )}

          {/* ---------------- you ---------------- */}
          {step === 'you' && (
            <motion.div key="you" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.4, ease }} className={`${card} p-6 sm:p-9`} style={cardStyle}>
              <H>{mode === 'edit' ? 'Save your new search' : 'Where should we send your homes?'}</H>
              <Explain>{mode === 'edit' ? 'Your Showcase updates right away.' : `We'll email you your Showcase link, and ${agentFirst} will reach out if you'd like help.`}</Explain>

              <ul className="mt-5 divide-y overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--site-line)' }}>
                {summary.map((c, i) => (
                  <motion.li key={c.k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05 }} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm" style={{ borderColor: 'var(--site-line)' }}>
                    <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--site-faint)' }}>{c.k}</span>
                    <span className="text-right font-bold" style={{ color: 'var(--site-heading)' }}>{c.v}</span>
                  </motion.li>
                ))}
              </ul>

              <div className="mt-6 grid gap-3">
                {visitor?.email && name && email === visitor.email ? (
                  <div className="flex items-center gap-3 rounded-2xl p-3.5" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
                    <span className="grid h-9 w-9 place-items-center rounded-full text-sm font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>{(name[0] || '?').toUpperCase()}</span>
                    <span className="min-w-0 flex-1 text-sm"><b className="block truncate" style={{ color: 'var(--site-heading)' }}>{name}</b><span className="block truncate" style={{ color: 'var(--site-muted)' }}>{email}</span></span>
                    <button type="button" onClick={() => setEmail('')} className="text-xs font-black underline-offset-4 hover:underline" style={{ color: 'var(--site-muted)' }}>Not you?</button>
                  </div>
                ) : (
                  <>
                    <Field label="Your name" value={name} onChange={setName} autoComplete="name" />
                    <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" invalid={!!email && !emailOk} />
                  </>
                )}
                <Field label="Phone" value={phone} onChange={setPhone} type="tel" autoComplete="tel" invalid={!!phone && !phoneOk} hint="So you can text with us about a home" />
              </div>

              <p className="mt-5 text-sm font-black" style={{ color: 'var(--site-heading)' }}>Are you already working with another real estate agent?</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {([['no', 'No'], ['yes', 'Yes, I am']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setHasAgent(v)} className="rounded-2xl border-2 py-3 text-sm font-black transition-colors"
                    style={hasAgent === v ? { borderColor: 'var(--site-accent)', backgroundColor: 'rgba(var(--site-accent-rgb),.1)', color: 'var(--site-heading)' } : { borderColor: 'var(--site-line)', color: 'var(--site-ink)' }}>{l}</button>
                ))}
              </div>

              {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
              <div className="mt-7 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11.5px] leading-snug" style={{ color: 'var(--site-faint)' }}>By continuing you agree {agent.name || 'the agent'} may contact you about homes. Unsubscribe anytime.</p>
                <button type="button" disabled={!youReady} onClick={submit} className={`${primaryBtn} sb-shine shrink-0`} style={primaryStyle}>
                  <Sparkles className="h-4 w-4" /> {mode === 'edit' ? 'Save my search' : 'Build my Showcase'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ---------------- building / ready ---------------- */}
          {step === 'building' && (
            <motion.div key="building" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45, ease }}
              className={`${card} px-6 py-12 text-center sm:px-10 sm:py-16`} style={cardStyle}>
              <AnimatePresence mode="wait">
                {!resultCode ? (
                  <motion.div key="work" exit={{ opacity: 0, y: -10 }}>
                    <div className="relative mx-auto h-28 w-28">
                      <span className="sb-ring absolute inset-0 rounded-full" />
                      <span className="absolute inset-3 grid place-items-center rounded-full" style={{ backgroundColor: 'rgba(var(--site-accent-rgb),.12)' }}>
                        <Home className="sb-bob h-10 w-10" style={{ color: 'var(--site-accent)' }} />
                      </span>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.p key={buildMsg % 4} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}
                        className={`mt-7 text-2xl font-black ${headingClass}`} style={{ color: 'var(--site-heading)' }}>
                        {[
                          where === 'home' && home ? `Drawing your circle around ${home.street}…` : where === 'district' ? 'Finding homes in your school district…' : `Looking in ${towns.map(titleTown).slice(0, 2).join(' & ') || 'your towns'}…`,
                          'Checking every home for sale…', 'Keeping only the ones that fit…', 'Setting up your new-home alerts…',
                        ][buildMsg % 4]}
                      </motion.p>
                    </AnimatePresence>
                    <p className="mt-2 text-sm" style={{ color: 'var(--site-muted)' }}>Just a few seconds.</p>
                  </motion.div>
                ) : (
                  <motion.div key="ready" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease }}>
                    <div className="relative mx-auto grid h-24 w-24 place-items-center">
                      {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <span key={i} className="sb-spark" style={{ ['--a' as any]: `${i * 45}deg`, animationDelay: `${i * 40}ms` }} />)}
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 16 }}
                        className="grid h-20 w-20 place-items-center rounded-full shadow-[0_20px_40px_-14px_rgba(var(--site-accent-rgb),.9)]" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
                        <Check className="h-9 w-9" strokeWidth={3} />
                      </motion.span>
                    </div>
                    <h2 className={`mt-7 text-3xl font-black ${headingClass}`} style={{ color: 'var(--site-heading)' }}>{mode === 'edit' ? 'Your search is updated' : `Your Showcase is ready${name ? `, ${name.split(' ')[0]}` : ''}!`}</h2>
                    <p className="mx-auto mt-2 max-w-md text-[15px]" style={{ color: 'var(--site-muted)' }}>It lives in the menu up top - and we just emailed you the link. New homes show up there the moment they list.</p>
                    <a href={`${basePrefix}/my-showcase`} className={`${primaryBtn} sb-shine mt-7`} style={primaryStyle}><Sparkles className="h-4 w-4" /> See my Showcase</a>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {step === 'represented' && (
            <motion.div key="rep" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`${card} p-8 text-center`} style={cardStyle}>
              <H>Thanks for letting us know!</H>
              <Explain>Since you&apos;re already working with an agent, we won&apos;t build you a Showcase - your agent is the best person to help. Enjoy looking around the site.</Explain>
              <a href={`${basePrefix}/search`} className={`${primaryBtn} mt-6`} style={primaryStyle}><Search className="h-4 w-4" /> Search homes</a>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------------------------

function HomeSearch({ picked, onPick, onClear }: { picked: PickedHome | null; onPick: (h: PickedHome) => void; onClear: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const s = q.trim()
    if (s.length < 3 || picked) { setResults([]); return }
    let cancelled = false
    setBusy(true)
    const t = window.setTimeout(async () => {
      const r = await api.properties.addressesPublic(s).catch(() => null)
      if (cancelled) return
      setResults(((r as any)?.data?.results || []).filter((x: any) => x.lat != null && x.lng != null))
      setBusy(false)
    }, 220)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [q, picked])

  if (picked) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex items-center gap-3 rounded-2xl border-2 p-3" style={{ borderColor: 'var(--site-accent)' }}>
        <span className="h-14 w-16 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
          {picked.photo ? <img src={picked.photo} alt="" className="h-full w-full object-cover" /> : <Home className="m-auto mt-4 h-6 w-6" style={{ color: 'var(--site-faint)' }} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-black" style={{ color: 'var(--site-heading)' }}>{picked.street}</span>
          <span className="block truncate text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>{[picked.place, picked.price ? money(picked.price) : null, picked.beds ? `${picked.beds} bd` : null].filter(Boolean).join(' · ')}</span>
        </span>
        <button type="button" onClick={() => { onClear(); setQ(''); window.setTimeout(() => input.current?.focus(), 30) }} className="rounded-full px-3 py-1.5 text-xs font-black" style={{ backgroundColor: 'var(--site-bg-alt)', color: 'var(--site-muted)' }}>Change</button>
      </motion.div>
    )
  }
  return (
    <div className="mt-5">
      <label className="flex items-center gap-3 rounded-2xl border-2 px-4 transition focus-within:shadow-[0_0_0_4px_rgba(var(--site-accent-rgb),.15)]" style={{ borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-bg)' }}>
        <Search className="h-5 w-5 shrink-0" style={{ color: 'var(--site-accent)' }} />
        <input ref={input} value={q} onChange={e => setQ(e.target.value)} autoFocus autoComplete="off" placeholder="Start typing the address…" aria-label="Address"
          className="h-14 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none" style={{ color: 'var(--site-ink)' }} />
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: 'var(--site-faint)' }} />}
      </label>
      <AnimatePresence initial={false}>
        {results.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }} className="mt-2 space-y-1 overflow-hidden">
            {results.map((r: any) => (
              <li key={r.listing_key || r.address}>
                <button type="button" onClick={() => onPick({ address: r.address, street: r.street || r.address.split(',')[0], place: [r.city, r.state].filter(Boolean).join(', '), lat: r.lat, lng: r.lng, price: r.price, beds: r.beds, baths: r.baths, photo: r.photo ? resolveMediaUrl(r.photo) || r.photo : null })}
                  className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-[rgba(var(--site-accent-rgb),.07)]">
                  <span className="h-12 w-14 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: 'var(--site-bg-alt)' }}>{r.photo && <img src={resolveMediaUrl(r.photo) || r.photo} alt="" className="h-full w-full object-cover" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-black" style={{ color: 'var(--site-heading)' }}>{r.street || r.address}</span>
                    <span className="block truncate text-xs font-semibold" style={{ color: 'var(--site-muted)' }}>{[r.city, r.price ? money(r.price) : null, r.beds ? `${r.beds} bd` : null].filter(Boolean).join(' · ')}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" style={{ color: 'var(--site-faint)' }} />
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function LookupAdd({ placeholder, lookup, picked, onAdd, autoFocus }: { placeholder: string; lookup: (q: string) => Promise<any>; picked: string[]; onAdd: (v: string) => void; autoFocus?: boolean }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<string[]>([])
  useEffect(() => {
    const s = q.trim()
    if (s.length < 2) { setResults([]); return }
    let cancelled = false
    const t = window.setTimeout(async () => {
      const r = await lookup(s).catch(() => null)
      if (!cancelled) setResults(((r as any)?.data?.results || (r as any)?.results || []).filter((x: string) => !picked.includes(x)).slice(0, 6))
    }, 200)
    return () => { cancelled = true; window.clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])
  return (
    <div className="relative mt-4">
      <label className="flex items-center gap-3 rounded-2xl border-2 px-4 transition focus-within:shadow-[0_0_0_4px_rgba(var(--site-accent-rgb),.15)]" style={{ borderColor: 'var(--site-line-strong)', backgroundColor: 'var(--site-bg)' }}>
        <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--site-accent)' }} />
        <input value={q} onChange={e => setQ(e.target.value)} autoFocus={autoFocus} autoComplete="off" placeholder={placeholder} aria-label={placeholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" style={{ color: 'var(--site-ink)' }} />
      </label>
      <AnimatePresence>
        {results.length > 0 && (
          <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl border shadow-xl" style={{ backgroundColor: 'var(--site-surface)', borderColor: 'var(--site-line)' }}>
            {results.map(r => (
              <li key={r}>
                <button type="button" onClick={() => { onAdd(r); setQ(''); setResults([]) }} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm font-bold transition hover:bg-[rgba(var(--site-accent-rgb),.08)]" style={{ color: 'var(--site-heading)' }}>
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: 'var(--site-accent)' }} />{titleTown(r)}<span className="ml-auto text-xs font-semibold" style={{ color: 'var(--site-faint)' }}>{r.split(',')[1]?.trim()}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function Picked({ items, onRemove }: { items: string[]; onRemove: (v: string) => void }) {
  if (!items.length) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <AnimatePresence initial={false}>
        {items.map(v => (
          <motion.span key={v} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            className="inline-flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-1.5 text-sm font-black" style={{ backgroundColor: 'var(--site-accent)', color: 'var(--site-on-accent)' }}>
            {titleTown(v)}
            <button type="button" onClick={() => onRemove(v)} aria-label={`Remove ${titleTown(v)}`} className="grid h-5 w-5 place-items-center rounded-full bg-black/15"><X className="h-3 w-3" /></button>
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

function Choice({ label, icon: Icon, values, value, onChange, id, fmt }: { label: string; icon: LucideIcon; values: number[]; value: number; onChange: (v: number) => void; id: string; fmt: (v: number) => string }) {
  return (
    <div className="mt-7">
      <p className="flex items-center gap-2 text-sm font-black" style={{ color: 'var(--site-heading)' }}><Icon className="h-4 w-4" style={{ color: 'var(--site-accent)' }} />{label}</p>
      <div className="mt-2.5 grid grid-cols-6 gap-1 rounded-2xl p-1" style={{ backgroundColor: 'var(--site-bg-alt)' }}>
        {values.map(v => {
          const on = value === v
          return (
            <button key={v} type="button" onClick={() => onChange(v)} className="relative rounded-xl py-2.5 text-[13px] font-black transition-colors" style={{ color: on ? 'var(--site-on-accent)' : 'var(--site-ink)' }}>
              {on && <motion.span layoutId={`sb-${id}`} className="absolute inset-0 rounded-xl shadow-md" style={{ backgroundColor: 'var(--site-accent)' }} transition={{ type: 'spring', stiffness: 460, damping: 34 }} />}
              <span className="relative">{fmt(v)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PriceRange({ lo, hi, max, onChange }: { lo: number; hi: number; max: number; onChange: (lo: number, hi: number) => void }) {
  const pct = (i: number) => `${(i / max) * 100}%`
  return (
    <div className="relative mt-4 h-8">
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full" style={{ backgroundColor: 'var(--site-line)' }} />
      <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full" style={{ left: pct(lo), right: `calc(100% - ${pct(hi)})`, backgroundColor: 'var(--site-accent)' }} />
      <input type="range" min={0} max={max} value={lo} aria-label="Lowest price" className="sb-range" onChange={e => onChange(Math.min(Number(e.target.value), hi - 1), hi)} />
      <input type="range" min={0} max={max} value={hi} aria-label="Highest price" className="sb-range" onChange={e => onChange(lo, Math.max(Number(e.target.value), lo + 1))} />
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', autoComplete, invalid, hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; autoComplete?: string; invalid?: boolean; hint?: string }) {
  return (
    <label className="block">
      <span className="text-[12px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--site-faint)' }}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete}
        className="mt-1.5 w-full rounded-2xl border-2 px-4 py-3 text-[16px] font-semibold outline-none transition focus:shadow-[0_0_0_4px_rgba(var(--site-accent-rgb),.15)]"
        style={{ borderColor: invalid ? '#ef4444' : 'var(--site-line-strong)', backgroundColor: 'var(--site-bg)', color: 'var(--site-ink)' }} />
      {hint && <span className="mt-1 block text-[11.5px]" style={{ color: 'var(--site-faint)' }}>{hint}</span>}
    </label>
  )
}

const BUILDER_CSS = `
.sb-orb{position:absolute;border-radius:9999px;opacity:.55;will-change:transform}
.sb-orb-a{width:620px;height:620px;left:-180px;top:-220px;background:radial-gradient(closest-side,rgba(var(--site-accent-rgb),.28),transparent);animation:sbDrift 16s ease-in-out infinite alternate}
.sb-orb-b{width:520px;height:520px;right:-200px;bottom:-160px;background:radial-gradient(closest-side,rgba(var(--site-accent-rgb),.18),transparent);animation:sbDrift 19s ease-in-out infinite alternate-reverse}
@keyframes sbDrift{to{transform:translate(60px,40px) scale(1.08)}}
.sb-shine{position:relative;overflow:hidden}
.sb-shine::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);transform:translateX(-120%);animation:sbShine 3.2s ease-in-out 1s infinite}
@keyframes sbShine{60%,100%{transform:translateX(120%)}}
.sb-picked{box-shadow:0 18px 40px -26px rgba(var(--site-accent-rgb),.9)}
.sb-ring{background:conic-gradient(from 0deg,var(--site-accent),transparent 35%,var(--site-accent) 70%,transparent);-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));mask:radial-gradient(farthest-side,transparent calc(100% - 4px),#000 calc(100% - 3px));animation:sbSpin 1.4s linear infinite}
@keyframes sbSpin{to{transform:rotate(360deg)}}
.sb-bob{animation:sbBob 1.4s ease-in-out infinite}
@keyframes sbBob{50%{transform:translateY(-5px)}}
.sb-spark{position:absolute;left:50%;top:50%;width:6px;height:6px;margin:-3px;border-radius:9999px;background:var(--site-accent);opacity:0;animation:sbSpark .9s cubic-bezier(.16,1,.3,1) .15s both}
@keyframes sbSpark{0%{opacity:1;transform:rotate(var(--a)) translateY(0)}100%{opacity:0;transform:rotate(var(--a)) translateY(-62px)}}
.sb-range{position:absolute;inset:0;width:100%;height:100%;-webkit-appearance:none;appearance:none;background:transparent;pointer-events:none;margin:0}
.sb-range::-webkit-slider-thumb{-webkit-appearance:none;pointer-events:auto;width:28px;height:28px;border-radius:9999px;background:#fff;border:3px solid var(--site-accent);box-shadow:0 4px 12px rgba(0,0,0,.25);cursor:grab}
.sb-range::-moz-range-thumb{pointer-events:auto;width:22px;height:22px;border-radius:9999px;background:#fff;border:3px solid var(--site-accent);box-shadow:0 4px 12px rgba(0,0,0,.25);cursor:grab}
@media (prefers-reduced-motion:reduce){.sb-orb,.sb-shine::after,.sb-ring,.sb-bob{animation:none}}
`
