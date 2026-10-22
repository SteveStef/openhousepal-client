'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { CalendarDays, CalendarPlus, Check, ChevronDown, Clock, HelpCircle, Loader2, Mail, MapPin, MessageSquare, Navigation, Pencil, Phone, X } from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import {
  accentOf, clockRange, dayLong, googleCalendarUrl, icsUrl, initialsOf, invitesApi, mapsUrl, mix, onAccent,
  type InviteQuestion, type InviteRsvp, type PublicInvite, type RsvpResponse,
} from '@/lib/invites'
import { mailHref, smsHref } from '@/lib/smsLink'
import InviteCard, { coverOf, type InviteCardData } from './InviteCard'
import InviteEnvelope from './InviteEnvelope'
import { SERIF, inviteSerif } from './inviteFonts'

// The guest's invitation page: the envelope opens, then the card, the details (when / where / the
// home / the host), and the RSVP - yes / maybe / can't make it, the agent's questions, a "you're on
// the list" moment, Add to calendar, and a way back to change the answer later (the browser keeps
// their private RSVP key; their confirmation email's link carries it too).

type Theme = { bg: string; surface: string; border: string; text: string; sub: string; dark: boolean }

function themeOf(design: string): Theme {
  if (design === 'midnight') return { bg: '#090b10', surface: '#12161f', border: 'rgba(255,255,255,.08)', text: '#f3efe6', sub: '#a29d93', dark: true }
  if (design === 'garden') return { bg: '#eceadf', surface: '#fbfaf5', border: 'rgba(38,48,42,.10)', text: '#1f2a23', sub: '#66706a', dark: false }
  if (design === 'modern') return { bg: '#efefec', surface: '#ffffff', border: 'rgba(17,24,39,.08)', text: '#111827', sub: '#6b7280', dark: false }
  return { bg: '#efe8db', surface: '#fdfbf6', border: 'rgba(60,45,20,.10)', text: '#1f1b16', sub: '#73695c', dark: false }
}

const storeKey = (code: string) => `ohp-invite-rsvp:${code}`
const readToken = (code: string) => { try { return localStorage.getItem(storeKey(code)) } catch { return null } }
const saveToken = (code: string, token: string) => { try { localStorage.setItem(storeKey(code), token) } catch { /* private mode */ } }

export default function InvitePublicPage({ code, host }: { code: string; host: string }) {
  const [inv, setInv] = useState<PublicInvite | null>(null)
  const [missing, setMissing] = useState(false)
  const [opened, setOpened] = useState(false)
  const [skipEnvelope, setSkipEnvelope] = useState(false)
  const [mine, setMine] = useState<InviteRsvp | null>(null)
  const [editing, setEditing] = useState(false)
  const [justSent, setJustSent] = useState<InviteRsvp | null>(null)
  const rsvpRef = useRef<HTMLDivElement>(null)
  // The phone's RSVP bar steps aside while the RSVP card itself is on screen.
  const [rsvpInView, setRsvpInView] = useState(false)
  useEffect(() => {
    const el = rsvpRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setRsvpInView(e.isIntersecting), { threshold: 0.15 })
    io.observe(el)
    return () => io.disconnect()
  }, [inv])

  useEffect(() => {
    let live = true
    const params = new URLSearchParams(window.location.search)
    const token = params.get('r') || readToken(code)
    if (token) setSkipEnvelope(true)
    invitesApi.publicGet(code, host).then(r => {
      if (!live) return
      if (!r.success) { setMissing(true); return }
      if (!r.data.host_ok) { window.location.replace(r.data.platform_url); return }
      setInv(r.data)
      try {
        if (!sessionStorage.getItem(`ohp-invite-seen:${code}`)) { sessionStorage.setItem(`ohp-invite-seen:${code}`, '1'); invitesApi.publicView(code) }
      } catch { invitesApi.publicView(code) }
    })
    if (token) {
      invitesApi.publicMine(code, token).then(r => {
        if (!live || !r.success) return
        setMine({ ...r.data, token })
        saveToken(code, token)
      })
    }
    return () => { live = false }
  }, [code, host])

  const accent = accentOf(inv?.accent_color)
  const t = themeOf(inv?.design || 'classic')
  const cardData: InviteCardData | null = inv ? { ...inv, hostName: inv.agent.name, hostBrokerage: inv.agent.brokerage, hostPhoto: inv.agent.photo_url } : null
  const closed = inv?.status === 'closed'
  const past = !!inv?.is_past

  if (missing) {
    return (
      <div className={`${inviteSerif.className} grid min-h-screen place-items-center bg-[#efe8db] px-6 text-center`}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#a8843a]">Invitation</p>
          <h1 className="mt-2 text-3xl font-bold text-[#1f1b16]" style={{ fontFamily: SERIF }}>This invitation isn't available</h1>
          <p className="mt-2 text-sm text-[#73695c]">The link may be old, or the host took it down. Reach out to whoever sent it to you.</p>
        </div>
      </div>
    )
  }
  if (!inv || !cardData) {
    return <div className="grid min-h-screen place-items-center bg-[#efe8db]"><Loader2 className="h-6 w-6 animate-spin text-[#a8843a]" /></div>
  }

  const showEnvelope = !opened && !skipEnvelope
  const goRsvp = () => rsvpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const responded = mine && !editing

  return (
    <div className="min-h-screen" style={{ background: t.bg, color: t.text }} data-testid="invite-page">
      <AnimatePresence>
        {showEnvelope && <InviteEnvelope key="env" data={cardData} hostName={inv.agent.name} stageBg={t.bg} onOpened={() => setOpened(true)} />}
      </AnimatePresence>

      {/* computer: the cover photo fills the room behind everything, faded into the page colour
          (a still image and a gradient - no blur, nothing moving) */}
      {coverOf(inv) && (
        <div aria-hidden className="pointer-events-none fixed inset-0 hidden lg:block">
          <img src={coverOf(inv)} alt="" className="h-full w-full object-cover" style={{ opacity: t.dark ? 0.22 : 0.16 }} />
          <div className="absolute inset-0" style={{ background: `radial-gradient(70% 80% at 30% 40%, transparent 0%, ${t.bg} 75%), linear-gradient(180deg, transparent 0%, ${t.bg} 92%)` }} />
        </div>
      )}

      {/* computer: who it's from, along the top */}
      <motion.header className="relative mx-auto hidden max-w-6xl items-center justify-between px-6 pt-8 lg:flex"
        initial={{ opacity: 0, y: -10 }} animate={showEnvelope ? { opacity: 0 } : { opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="flex items-center gap-3">
          <Avatar photo={inv.agent.photo_url} name={inv.agent.name} accent={accent} size={44} />
          <div>
            <p className="text-[15px] font-black" style={{ fontFamily: SERIF }}>{inv.agent.name}</p>
            <p className="text-[12px] font-semibold" style={{ color: t.sub }}>{[inv.agent.title, inv.agent.brokerage].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Countdown date={inv.event_date} accent={accent} t={t} />
          {inv.agent.logo_url && <img src={resolveMediaUrl(inv.agent.logo_url)} alt="" className="h-10 max-w-[140px] object-contain" />}
        </div>
      </motion.header>

      <main className="relative mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start lg:gap-16 lg:pb-20 lg:pt-10">
        {/* ---- the card */}
        <motion.section className="lg:sticky lg:top-10"
          initial={skipEnvelope ? { opacity: 0, y: 14 } : { opacity: 0, y: -30, scale: 0.94 }}
          animate={showEnvelope ? { opacity: 0 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 140, damping: 20 }}>
          <TiltCard>
            <InviteCard data={cardData} />
          </TiltCard>
        </motion.section>

        {/* ---- everything else */}
        <motion.div className="mx-auto mt-6 max-w-[520px] space-y-4 lg:mt-0"
          initial={{ opacity: 0, y: 24 }} animate={showEnvelope ? { opacity: 0 } : { opacity: 1, y: 0 }} transition={{ delay: skipEnvelope ? 0.05 : 0.25, type: 'spring', stiffness: 160, damping: 22 }}>

          {inv.message && (
            <Panel t={t}>
              <div className="flex gap-3">
                <Avatar photo={inv.agent.photo_url} name={inv.agent.name} accent={accent} size={40} />
                <div className="min-w-0">
                  <p className="text-[15px] leading-relaxed" style={{ fontFamily: SERIF, fontStyle: 'italic' }}>&ldquo;{inv.message}&rdquo;</p>
                  <p className="mt-1.5 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: t.sub }}>{inv.agent.name}</p>
                </div>
              </div>
            </Panel>
          )}

          {/* RSVP */}
          <div ref={rsvpRef} className="scroll-mt-6" id="rsvp">
            <Panel t={t} accent={accent} strong>
              <AnimatePresence mode="wait" initial={false}>
                {justSent ? (
                  <SentMoment key="sent" rsvp={justSent} inv={inv} accent={accent} t={t} onChange={() => { setJustSent(null); setEditing(true) }} onDone={() => setJustSent(null)} />
                ) : responded ? (
                  <motion.div key="mine" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: accent }}>Your RSVP</p>
                    <div className="mt-2 flex items-center gap-3">
                      <ResponseBadge response={mine!.response} accent={accent} />
                      <div className="min-w-0">
                        <p className="text-lg font-black" style={{ fontFamily: SERIF }}>
                          {mine!.response === 'yes' ? "You're on the list" : mine!.response === 'maybe' ? "You're a maybe" : "You can't make it"}
                        </p>
                        <p className="text-sm" style={{ color: t.sub }}>
                          {mine!.name}{mine!.response !== 'no' && mine!.guest_count > 1 ? ` · ${mine!.guest_count} coming` : ''}
                        </p>
                      </div>
                    </div>
                    {mine!.response !== 'no' && <CalendarButtons inv={inv} t={t} />}
                    {!closed && !past && (
                      <button type="button" onClick={() => setEditing(true)} data-testid="invite-change-rsvp"
                        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full px-4 text-[12px] font-black uppercase tracking-widest transition"
                        style={{ border: `1.5px solid ${accent}`, color: t.dark ? mix(accent, '#ffffff', 0.3) : mix(accent, '#000000', 0.2) }}>
                        <Pencil className="h-3.5 w-3.5" /> Change my RSVP
                      </button>
                    )}
                  </motion.div>
                ) : closed || past ? (
                  <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: accent }}>RSVP</p>
                    <p className="mt-1 text-xl font-black" style={{ fontFamily: SERIF }}>{past ? 'This event has passed' : 'RSVPs are closed'}</p>
                    <p className="mt-1 text-sm" style={{ color: t.sub }}>{past ? 'Thanks for your interest!' : `Reach out to ${inv.agent.name || 'the host'} if you'd still like to come.`}</p>
                  </motion.div>
                ) : (
                  <RsvpForm key="form" inv={inv} accent={accent} t={t} initial={mine} onSent={r => {
                    if (r.token) saveToken(code, r.token)
                    setMine(r)
                    setEditing(false)
                    setJustSent(r)
                  }} onCancel={mine ? () => setEditing(false) : undefined} />
                )}
              </AnimatePresence>
            </Panel>
          </div>

          {/* When */}
          <Panel t={t}>
            <Row icon={<CalendarDays className="h-5 w-5" />} accent={accent} label="When">
              <p className="text-[16px] font-black">{dayLong(inv.event_date) || 'Date to come'}</p>
              {inv.start_time && <p className="text-sm" style={{ color: t.sub }}><Clock className="mr-1 inline h-3.5 w-3.5" />{clockRange(inv.start_time, inv.end_time)}</p>}
            </Row>
            {inv.event_date && !past && <CalendarButtons inv={inv} t={t} />}
          </Panel>

          {/* Where */}
          {(inv.place_name || inv.address) && (
            <Panel t={t}>
              <Row icon={<MapPin className="h-5 w-5" />} accent={accent} label="Where">
                {inv.place_name && <p className="text-[16px] font-black">{inv.place_name}</p>}
                {inv.address && <p className={inv.place_name ? 'text-sm' : 'text-[16px] font-black'} style={inv.place_name ? { color: t.sub } : undefined}>{inv.address}</p>}
              </Row>
              {inv.address && (
                <a href={mapsUrl(inv.address)} target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex h-12 items-center justify-center gap-2 rounded-2xl text-[12px] font-black uppercase tracking-widest transition active:scale-[0.98]"
                  style={{ background: t.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: t.text }}>
                  <Navigation className="h-4 w-4" style={{ color: accent }} /> Get directions
                </a>
              )}
            </Panel>
          )}

          {/* The home */}
          {inv.linked_property?.address && <HomePanel inv={inv} t={t} accent={accent} />}

          {/* Host */}
          <Panel t={t}>
            <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: accent }}>Your host</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar photo={inv.agent.photo_url} name={inv.agent.name} accent={accent} size={56} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-black" style={{ fontFamily: SERIF }}>{inv.agent.name}</p>
                <p className="truncate text-sm" style={{ color: t.sub }}>{[inv.agent.title, inv.agent.brokerage].filter(Boolean).join(' · ')}</p>
              </div>
              {inv.agent.logo_url && <img src={resolveMediaUrl(inv.agent.logo_url)} alt="" className="h-9 max-w-[90px] object-contain" />}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {inv.agent.phone && <ContactBtn href={`tel:${inv.agent.phone.replace(/[^\d+]/g, '')}`} icon={<Phone className="h-4 w-4" />} label="Call" t={t} accent={accent} />}
              {(inv.agent.text_phone || inv.agent.phone) && <ContactBtn href={smsHref(inv.agent.text_phone || inv.agent.phone, `Hi ${inv.agent.name.split(' ')[0]}, about ${inv.title}: `)} icon={<MessageSquare className="h-4 w-4" />} label="Text" t={t} accent={accent} />}
              {inv.agent.email && <ContactBtn href={mailHref(inv.agent.email, inv.title)} icon={<Mail className="h-4 w-4" />} label="Email" t={t} accent={accent} />}
            </div>
          </Panel>

          <p className="pt-2 text-center text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: t.sub, opacity: 0.7 }}>Invitation by OpenHousePal</p>
        </motion.div>
      </main>

      {/* phone: the RSVP button stays in reach */}
      {!showEnvelope && !closed && !past && !justSent && (
        <div className={`fixed inset-x-0 bottom-0 z-40 px-4 pt-3 transition duration-300 lg:hidden ${rsvpInView ? 'pointer-events-none translate-y-full opacity-0' : ''}`} style={{ paddingBottom: 'max(0.9rem, env(safe-area-inset-bottom))', background: `linear-gradient(180deg, transparent, ${t.bg} 40%)` }}>
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={goRsvp} data-testid="invite-rsvp-bar"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-[0_18px_34px_-14px_rgba(0,0,0,.55)]"
            style={{ background: accent, color: onAccent(accent) }}>
            {responded ? <>Your RSVP: {mine!.response === 'yes' ? 'Coming' : mine!.response === 'maybe' ? 'Maybe' : "Can't make it"} <ChevronDown className="h-4 w-4" /></> : <>RSVP <ChevronDown className="h-4 w-4" /></>}
          </motion.button>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ pieces

/** On a computer the card leans toward the mouse, like holding a real one. Transforms only. */
function TiltCard({ children }: { children: React.ReactNode }) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const sx = useSpring(rx, { stiffness: 140, damping: 16 })
  const sy = useSpring(ry, { stiffness: 140, damping: 16 })
  const glare = useTransform(sy, [-8, 8], ['20%', '80%'])
  return (
    <div className="mx-auto max-w-[420px] lg:max-w-[460px]" style={{ perspective: 1200 }}
      onMouseMove={e => {
        if (window.matchMedia('(hover: none)').matches) return
        const r = e.currentTarget.getBoundingClientRect()
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 12)
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 10)
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0) }}>
      <motion.div style={{ rotateX: sx, rotateY: sy, transformStyle: 'preserve-3d' }} className="relative">
        {children}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 hidden rounded-[14px] lg:block"
          style={{ background: useTransform(glare, g => `linear-gradient(115deg, transparent 0%, rgba(255,255,255,.0) calc(${g} - 18%), rgba(255,255,255,.22) ${g}, rgba(255,255,255,0) calc(${g} + 18%), transparent 100%)`) }} />
      </motion.div>
    </div>
  )
}

function Countdown({ date, accent, t }: { date?: string | null; accent: string; t: Theme }) {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000)
  if (days < 0) return null
  const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
  return (
    <span className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[12px] font-black uppercase tracking-[0.18em]" style={{ background: t.surface, border: `1px solid ${mix(accent, t.dark ? '#000000' : '#ffffff', 0.3)}`, color: t.text }}>
      <span className="h-2 w-2 rounded-full" style={{ background: accent }} /> {label}
    </span>
  )
}

function Panel({ t, children, accent, strong = false }: { t: Theme; children: React.ReactNode; accent?: string; strong?: boolean }) {
  return (
    <section className="rounded-[22px] p-5 sm:p-6" style={{ background: t.surface, border: `1px solid ${strong && accent ? mix(accent, t.dark ? '#000000' : '#ffffff', 0.35) : t.border}`, boxShadow: t.dark ? 'none' : '0 18px 40px -32px rgba(60,45,20,.45)' }}>
      {children}
    </section>
  )
}

function Row({ icon, accent, label, children }: { icon: React.ReactNode; accent: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: mix(accent, '#ffffff', 0.82), color: mix(accent, '#000000', 0.25) }}>{icon}</span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: accent }}>{label}</p>
        {children}
      </div>
    </div>
  )
}

function Avatar({ photo, name, accent, size }: { photo?: string | null; name?: string | null; accent: string; size: number }) {
  return photo
    ? <img src={resolveMediaUrl(photo)} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, boxShadow: `0 0 0 2px ${accent}` }} />
    : <span className="grid shrink-0 place-items-center rounded-full font-black" style={{ width: size, height: size, background: accent, color: onAccent(accent), fontSize: size * 0.36 }}>{initialsOf(name)}</span>
}

function ContactBtn({ href, icon, label, t, accent }: { href: string; icon: React.ReactNode; label: string; t: Theme; accent: string }) {
  return (
    <a href={href} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition active:scale-[0.97]"
      style={{ background: t.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: t.text }}>
      <span style={{ color: accent }}>{icon}</span>{label}
    </a>
  )
}

function CalendarButtons({ inv, t }: { inv: PublicInvite; t: Theme }) {
  const link = typeof window !== 'undefined' ? window.location.href.split('?')[0] : inv.share_url
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <a href={googleCalendarUrl(inv, link)} target="_blank" rel="noopener noreferrer"
        className="flex h-12 items-center justify-center gap-2 rounded-2xl text-[11px] font-black uppercase tracking-wider transition active:scale-[0.98]"
        style={{ background: t.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: t.text }}>
        <CalendarPlus className="h-4 w-4" /> Google
      </a>
      <a href={icsUrl(inv.code)}
        className="flex h-12 items-center justify-center gap-2 rounded-2xl text-[11px] font-black uppercase tracking-wider transition active:scale-[0.98]"
        style={{ background: t.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', color: t.text }}>
        <CalendarPlus className="h-4 w-4" /> Apple / Outlook
      </a>
    </div>
  )
}

function ResponseBadge({ response, accent }: { response: RsvpResponse; accent: string }) {
  const Icon = response === 'yes' ? Check : response === 'maybe' ? HelpCircle : X
  const bg = response === 'yes' ? accent : response === 'maybe' ? mix(accent, '#ffffff', 0.6) : '#9ca3af'
  return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: bg, color: response === 'yes' ? onAccent(accent) : '#111827' }}><Icon className="h-6 w-6" strokeWidth={3} /></span>
}

function HomePanel({ inv, t, accent }: { inv: PublicInvite; t: Theme; accent: string }) {
  const lp = inv.linked_property!
  const photos = useMemo(() => [lp.image, ...(lp.photos || [])].filter((p, i, a): p is string => !!p && a.indexOf(p) === i).slice(0, 8), [lp])
  const facts = [
    lp.price ? `$${Math.round(lp.price).toLocaleString('en-US')}` : null,
    lp.beds ? `${lp.beds} bd` : null,
    lp.baths ? `${lp.baths} ba` : null,
    lp.sqft ? `${Math.round(lp.sqft).toLocaleString('en-US')} sq ft` : null,
  ].filter(Boolean)
  return (
    <Panel t={t}>
      <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: accent }}>The home</p>
      <p className="mt-1 text-lg font-black" style={{ fontFamily: SERIF }}>{lp.address}</p>
      {facts.length > 0 && <p className="text-sm font-bold" style={{ color: t.sub }}>{facts.join(' · ')}</p>}
      {photos.length > 1 && (
        <div className="-mx-5 mt-3 flex snap-x gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:-mx-6 sm:px-6">
          {photos.map(p => <img key={p} src={resolveMediaUrl(p)} alt="" loading="lazy" className="h-28 w-40 shrink-0 snap-start rounded-xl object-cover" />)}
        </div>
      )}
    </Panel>
  )
}

// ------------------------------------------------------------------ the RSVP form

const CHOICES: { id: RsvpResponse; label: string; icon: typeof Check }[] = [
  { id: 'yes', label: "I'll be there", icon: Check },
  { id: 'maybe', label: 'Maybe', icon: HelpCircle },
  { id: 'no', label: "Can't make it", icon: X },
]

function RsvpForm({ inv, accent, t, initial, onSent, onCancel }: {
  inv: PublicInvite; accent: string; t: Theme; initial: InviteRsvp | null
  onSent: (r: InviteRsvp) => void; onCancel?: () => void
}) {
  const [response, setResponse] = useState<RsvpResponse | null>(initial?.response || null)
  const [name, setName] = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [phone, setPhone] = useState(initial?.phone || '')
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(() => Object.fromEntries((initial?.answers || []).map(a => [a.questionId, a.value])))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const questions = (inv.questions || []).filter(q => response !== 'no' || q.role === 'brokerage')
  const isAgents = inv.audience === 'agents'

  const submit = async () => {
    if (!response) return
    setError('')
    if (!name.trim()) { setError('Add your name.'); return }
    if (!email.trim() && !phone.trim()) { setError(`Add an email or phone so ${inv.agent.name.split(' ')[0] || 'the host'} can reach you.`); return }
    const missing = questions.find(q => q.required && !(Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).length : String(answers[q.id] || '').trim()))
    if (missing) { setError(`Please answer: ${missing.label}`); return }
    setBusy(true)
    const r = await invitesApi.publicRsvp(inv.code, {
      response, name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined,
      answers: questions.filter(q => answers[q.id] !== undefined).map(q => ({ questionId: q.id, value: answers[q.id] })),
      token: initial?.token,
    })
    setBusy(false)
    if (!r.success) { setError(r.error); return }
    onSent(r.data)
  }

  const input = 'h-12 w-full rounded-2xl px-4 text-[15px] font-semibold outline-none transition focus:ring-2'
  const inputStyle = { background: t.dark ? 'rgba(255,255,255,.05)' : '#ffffff', border: `1px solid ${t.border}`, color: t.text, '--tw-ring-color': accent } as React.CSSProperties

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} data-testid="invite-rsvp-form">
      <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={{ color: accent }}>RSVP</p>
      <h2 className="mt-1 text-2xl font-black" style={{ fontFamily: SERIF }}>{initial ? 'Change your answer' : 'Will you be there?'}</h2>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {CHOICES.map(c => {
          const on = response === c.id
          return (
            <motion.button key={c.id} type="button" whileTap={{ scale: 0.95 }} onClick={() => setResponse(c.id)} data-testid={`rsvp-${c.id}`}
              className="relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center text-[12px] font-black transition-colors"
              style={on ? { background: accent, color: onAccent(accent), boxShadow: `0 14px 26px -14px ${accent}` } : { background: t.dark ? 'rgba(255,255,255,.05)' : '#ffffff', border: `1px solid ${t.border}`, color: t.text }}>
              <c.icon className="h-6 w-6" strokeWidth={2.6} />
              {c.label}
            </motion.button>
          )
        })}
      </div>

      <AnimatePresence initial={false}>
        {response && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 30 }} className="overflow-hidden">
            <div className="space-y-3 pt-5">
              <Field label="Your name" t={t}><input className={input} style={inputStyle} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="First and last name" data-testid="rsvp-name" /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email" t={t}><input className={input} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" data-testid="rsvp-email" /></Field>
                <Field label="Phone" t={t}><input className={input} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 555-0123" /></Field>
              </div>
              <p className="-mt-1 text-[11px]" style={{ color: t.sub }}>
                {isAgents ? 'So the host can send you the details.' : `Email or phone - only ${inv.agent.name.split(' ')[0] || 'the host'} sees it.`}
              </p>
              {questions.map(q => <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={v => setAnswers(a => ({ ...a, [q.id]: v }))} t={t} accent={accent} input={input} inputStyle={inputStyle} />)}
              {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-600">{error}</p>}
              <div className="flex gap-2 pt-1">
                {onCancel && (
                  <button type="button" onClick={onCancel} className="h-14 rounded-2xl px-4 text-[12px] font-black uppercase tracking-widest" style={{ color: t.sub }}>Cancel</button>
                )}
                <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={submit} disabled={busy} data-testid="rsvp-send"
                  className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[13px] font-black uppercase tracking-widest disabled:opacity-60"
                  style={{ background: accent, color: onAccent(accent), boxShadow: `0 18px 30px -16px ${accent}` }}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={3} />} {initial ? 'Update my RSVP' : 'Send my RSVP'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Field({ label, t, children }: { label: string; t: Theme; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: t.sub }}>{label}</span>
      {children}
    </label>
  )
}

function QuestionField({ q, value, onChange, t, accent, input, inputStyle }: {
  q: InviteQuestion; value: string | string[] | undefined; onChange: (v: string | string[]) => void; t: Theme; accent: string; input: string; inputStyle: React.CSSProperties
}) {
  const label = `${q.label}${q.required ? '' : ' (optional)'}`
  if (q.type === 'select' || q.type === 'multi_select') {
    const multi = q.type === 'multi_select'
    const picked = multi ? (Array.isArray(value) ? value : []) : value
    return (
      <div>
        <p className="mb-1.5 text-[13px] font-black">{label}</p>
        <div className="flex flex-wrap gap-2">
          {(q.options || []).map(o => {
            const on = multi ? (picked as string[]).includes(o) : picked === o
            return (
              <motion.button key={o} type="button" whileTap={{ scale: 0.95 }}
                onClick={() => multi ? onChange(on ? (picked as string[]).filter(x => x !== o) : [...(picked as string[]), o]) : onChange(o)}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-[13px] font-bold transition-colors"
                style={on ? { background: accent, color: onAccent(accent) } : { background: t.dark ? 'rgba(255,255,255,.05)' : '#ffffff', border: `1px solid ${t.border}`, color: t.text }}>
                {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}{o}
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }
  if (q.type === 'long_text') {
    return <Field label={label} t={t}><textarea className={`${input} h-24 resize-none py-3`} style={inputStyle} value={(value as string) || ''} placeholder={q.placeholder} onChange={e => onChange(e.target.value)} /></Field>
  }
  const type = q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'
  return <Field label={label} t={t}><input className={input} style={inputStyle} type={type} value={(value as string) || ''} placeholder={q.placeholder} onChange={e => onChange(e.target.value)} /></Field>
}

// ------------------------------------------------------------------ the "you're on the list" moment

function SentMoment({ rsvp, inv, accent, t, onChange, onDone }: { rsvp: InviteRsvp; inv: PublicInvite; accent: string; t: Theme; onChange: () => void; onDone: () => void }) {
  const title = rsvp.response === 'yes' ? "You're on the list!" : rsvp.response === 'maybe' ? 'Got it - you\'re a maybe' : 'Thanks for letting us know'
  const text = rsvp.response === 'no'
    ? `${inv.agent.name.split(' ')[0] || 'Your host'} will be sorry to miss you.`
    : `${inv.agent.name.split(' ')[0] || 'Your host'} has your RSVP${rsvp.guest_count > 1 ? ` for ${rsvp.guest_count}` : ''}.${rsvp.email ? ' A confirmation is on its way to your inbox.' : ''}`
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="flex flex-col items-center py-4 text-center" data-testid="invite-sent">
      <div className="relative">
        <motion.span className="absolute inset-0 rounded-full" style={{ background: accent, opacity: 0.3 }} initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 2.3, opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.05 }}
          className="relative grid h-20 w-20 place-items-center rounded-full" style={{ background: rsvp.response === 'no' ? '#9ca3af' : accent, boxShadow: `0 18px 40px -14px ${accent}` }}>
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke={rsvp.response === 'no' ? '#ffffff' : onAccent(accent)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }} />
          </svg>
        </motion.div>
        {rsvp.response !== 'no' && Array.from({ length: 16 }).map((_, i) => {
          const a = (i / 16) * Math.PI * 2
          return <motion.span key={i} className="absolute left-1/2 top-1/2 rounded-sm" style={{ width: i % 2 ? 6 : 8, height: i % 2 ? 6 : 4, background: i % 3 === 0 ? accent : i % 3 === 1 ? mix(accent, '#ffffff', 0.5) : (t.dark ? '#ffffff' : '#111827') }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }} animate={{ x: Math.cos(a) * 90, y: Math.sin(a) * 90 + 20, opacity: 0, rotate: 180 }} transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }} />
        })}
      </div>
      <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6 text-3xl font-black" style={{ fontFamily: SERIF }}>{title}</motion.h3>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-2 max-w-sm text-sm" style={{ color: t.sub }}>{text}</motion.p>
      {rsvp.response !== 'no' && <div className="mt-2 w-full"><CalendarButtons inv={inv} t={t} /></div>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onChange} className="h-11 rounded-full px-4 text-[11px] font-black uppercase tracking-widest" style={{ border: `1.5px solid ${accent}`, color: t.text }}>Change my RSVP</button>
        <button type="button" onClick={onDone} className="h-11 rounded-full px-4 text-[11px] font-black uppercase tracking-widest" style={{ color: t.sub }}>Done</button>
      </div>
    </motion.div>
  )
}


