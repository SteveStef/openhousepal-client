'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import {
  ArrowLeft, Bath, Bed, BellRing, CalendarCheck, CalendarDays, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, GraduationCap, HelpCircle,
  Loader2, Mail, MapPin, MessageSquare, Moon, Navigation, Pencil, Phone, Ruler, ScanSearch, Sun, Sunrise, X,
} from 'lucide-react'
import { resolveMediaUrl } from '@/lib/api-service'
import { sizedImage } from '@/lib/siteImage'
import {
  accentOf, allDays, askedByRsvp, clockRange, dayLong, daysText, googleCalendarUrl, icsUrl, initialsOf, invitesApi, mix, onAccent, parseDay,
  type InviteDay, type InviteQuestion, type InviteRequestKind, type InviteRsvp, type PublicInvite, type RsvpResponse,
} from '@/lib/invites'
import { openDirections } from '@/lib/directions'
import { readVisitor, saveVisitor } from '@/lib/visitor'
import { backdropMotion, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import OhpLoader from '@/components/brand/OhpLoader'
import { type MetalPalette } from '@/lib/luxeMetals'
import InviteCard, { coverOf, type InviteCardData } from './InviteCard'
import InviteEnvelope from './InviteEnvelope'
import InviteLuxeOpening, { foilOf, metalOfInvite } from './InviteLuxeOpening'
import { SERIF, inviteSerif } from './inviteFonts'

// The Cheat Sheet only loads when a guest opens it.
const CheatSheetView = dynamic(() => import('@/components/guest-pass/CheatSheetView'), { ssr: false })

// The guest's invitation page: the opening (Normal = the envelope; Luxe = the lacquer & foil
// reveal), then the card, the details (when / where / the home / the host), and the RSVP - yes /
// maybe / can't make it, then the questions ONE AT A TIME in a pull-up on a phone (inline on a
// computer): which day(s), name, contact, "Are you a real estate agent?" / "working with one?",
// the agent's questions. "Can't make it" asks "still interested in the home?" (No = no worries;
// Yes = their info + "keep me updated"). After answering, the RSVP card becomes the calendar card
// (Google + Apple). The Guest Pass's tools sit under the home: Cheat Sheet, seller disclosure,
// second tour + Stay updated. The browser keeps their private RSVP key; their email's link too.

type Theme = { bg: string; surface: string; border: string; text: string; sub: string; dark: boolean; luxe: boolean; m?: MetalPalette; foil?: string }

function themeOf(design: string): Theme {
  if (design === 'midnight') return { bg: '#090b10', surface: '#12161f', border: 'rgba(255,255,255,.08)', text: '#f3efe6', sub: '#a29d93', dark: true, luxe: false }
  if (design === 'garden') return { bg: '#eceadf', surface: '#fbfaf5', border: 'rgba(38,48,42,.10)', text: '#1f2a23', sub: '#66706a', dark: false, luxe: false }
  if (design === 'modern') return { bg: '#efefec', surface: '#ffffff', border: 'rgba(17,24,39,.08)', text: '#111827', sub: '#6b7280', dark: false, luxe: false }
  return { bg: '#efe8db', surface: '#fdfbf6', border: 'rgba(60,45,20,.10)', text: '#1f1b16', sub: '#73695c', dark: false, luxe: false }
}
function luxeTheme(m: MetalPalette): Theme {
  return { bg: '#060607', surface: 'rgba(20,19,22,.78)', border: `rgba(${m.rgb},.26)`, text: '#f4efe6', sub: '#aaa294', dark: true, luxe: true, m, foil: foilOf(m) }
}
/** The page's main button colour: the accent - or, in Luxe, the foil with dark type. */
const btnStyle = (t: Theme, accent: string): React.CSSProperties => t.luxe && t.foil
  ? { backgroundImage: t.foil, backgroundSize: '200% 100%', color: '#17140f', boxShadow: `0 18px 34px -16px rgba(${t.m!.rgb},.8)` }
  : { background: accent, color: onAccent(accent), boxShadow: `0 18px 30px -16px ${accent}` }
const foilText = (t: Theme, accent: string): React.CSSProperties => t.luxe && t.foil
  ? { backgroundImage: t.foil, backgroundSize: '220% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }
  : { color: accent }
const soft = (t: Theme) => (t.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)')
/** Service area · brokerage under the agent's name (round 5) - each piece kept whole, so a narrow
 *  screen wraps between them, never mid-name. Missing pieces are left out. */
const quietLine = (a: { market?: string; brokerage?: string }) => {
  const parts = [a.market, a.brokerage].map(x => (x || '').trim()).filter(Boolean)
  return parts.map((x, i) => <span key={i} className="inline-block max-w-full">{x}{i < parts.length - 1 ? <>&nbsp;·&nbsp;</> : null}</span>)
}

const storeKey = (code: string) => `ohp-invite-rsvp:${code}`
const readToken = (code: string) => { try { return localStorage.getItem(storeKey(code)) } catch { return null } }
const saveToken = (code: string, token: string) => { try { localStorage.setItem(storeKey(code), token) } catch { /* private mode */ } }
const reqKey = (code: string) => `ohp-invite-req:${code}`
const readReqs = (code: string): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(reqKey(code)) || '{}') } catch { return {} } }
const saveReq = (code: string, kind: string) => { try { localStorage.setItem(reqKey(code), JSON.stringify({ ...readReqs(code), [kind]: true })) } catch { /* private mode */ } }

export default function InvitePublicPage({ code, host }: { code: string; host: string }) {
  const [inv, setInv] = useState<PublicInvite | null>(null)
  const [missing, setMissing] = useState(false)
  const [opened, setOpened] = useState(false)
  const [skipEnvelope, setSkipEnvelope] = useState(false)
  const [mine, setMine] = useState<InviteRsvp | null>(null)
  const [justSent, setJustSent] = useState<InviteRsvp | null>(null)
  const [flow, setFlow] = useState<RsvpResponse | null>(null)
  const [requested, setRequested] = useState<Record<string, boolean>>({})
  const [ask, setAsk] = useState<InviteRequestKind | null>(null)
  const [cheat, setCheat] = useState(false)
  const phone = useIsPhone()
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
    setRequested(readReqs(code))
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
        setRequested(q => ({ ...q, ...Object.fromEntries(Object.keys(r.data.requests || {}).map(k => [k, true])) }))
        saveToken(code, token)
      })
    }
    return () => { live = false }
  }, [code, host])

  const m = inv ? metalOfInvite(inv) : null
  const luxe = inv?.motion === 'luxe'
  const accent = accentOf(inv?.accent_color)
  const t = luxe && m ? luxeTheme(m) : themeOf(inv?.design || 'classic')
  const cardData: InviteCardData | null = inv ? { ...inv, hostName: inv.agent.name, hostBrokerage: inv.agent.brokerage, hostPhoto: inv.agent.photo_url, hostArea: inv.agent.market || null } : null
  const closed = inv?.status === 'closed'
  const past = !!inv?.is_past
  const days = inv ? (inv.dates?.length ? inv.dates : allDays(inv)) : []

  const sendRequest = useCallback(async (kind: InviteRequestKind, extra: { name?: string; email?: string; phone?: string; times?: string } = {}) => {
    if (!inv) return { ok: false, error: '' }
    const r = await invitesApi.publicRequest(inv.code, { kind, token: mine?.token, ...extra })
    if (!r.success) return { ok: false, error: r.error }
    saveReq(inv.code, kind)
    setRequested(q => ({ ...q, [kind]: true }))
    if (extra.name || extra.email) saveVisitor({ name: extra.name || '', email: extra.email || '', phone: extra.phone || undefined })
    return { ok: true, error: '' }
  }, [inv, mine?.token])

  if (missing) {
    return (
      <div className={`${inviteSerif.className} grid min-h-screen place-items-center bg-[#efe8db] px-6 text-center`}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#a8843a]">Invitation</p>
          <h1 className="mt-2 text-3xl font-bold text-[#1f1b16]" style={{ fontFamily: SERIF }}>This invitation isn&apos;t available</h1>
          <p className="mt-2 text-sm text-[#73695c]">The link may be old, or the host took it down. Reach out to whoever sent it to you.</p>
        </div>
      </div>
    )
  }
  // A guest page: the house loader only (never our wordmark) until the invitation is in.
  if (!inv || !cardData) return <OhpLoader guest />

  const showEnvelope = !opened && !skipEnvelope
  const goRsvp = () => rsvpRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const responded = !!mine
  const myDays = mine?.days?.length ? days.filter(d => mine.days!.includes(d.date)) : days
  const isHome = !!inv.linked_property?.address
  const details = ((inv as unknown as { home_details?: HomeDetails | null }).home_details) || null
  const showCal = days.length > 0 && !past && (!mine || mine.response === 'no') && !justSent
  const pick = (r: RsvpResponse) => { setJustSent(null); setFlow(r) }
  const onSent = (r: InviteRsvp) => {
    if (r.token) saveToken(code, r.token)
    setMine(r)
    setFlow(null)
    setJustSent(r)
    if (r.keep_updated) { saveReq(code, 'updates'); setRequested(q => ({ ...q, updates: true })) }
  }

  const reveal = (i: number) => ({
    initial: { opacity: 0, y: 26 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-30px' },
    transition: { duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] as const },
  })

  return (
    <div className="min-h-screen" style={{ background: t.bg, color: t.text }} data-testid="invite-page" data-motion={luxe ? 'luxe' : 'normal'}>
      <style>{PAGE_CSS}</style>
      <AnimatePresence>
        {showEnvelope && (luxe
          ? <InviteLuxeOpening key="lux" data={cardData} hostName={inv.agent.name} onOpened={() => setOpened(true)} />
          : <InviteEnvelope key="env" data={cardData} hostName={inv.agent.name} stageBg={t.bg} onOpened={() => setOpened(true)} />)}
      </AnimatePresence>

      {luxe && m ? <LuxeBackdrop m={m} /> : coverOf(inv) && (
        // computer: the cover photo fills the room behind everything, faded into the page colour
        <div aria-hidden className="pointer-events-none fixed inset-0 hidden lg:block">
          <img src={sizedImage(coverOf(inv), 1200, 70)} alt="" className="h-full w-full object-cover" style={{ opacity: t.dark ? 0.22 : 0.16, objectPosition: inv.cover_position ? `${inv.cover_position.x}% ${inv.cover_position.y}%` : undefined }} />
          <div className="absolute inset-0" style={{ background: `radial-gradient(70% 80% at 30% 40%, transparent 0%, ${t.bg} 75%), linear-gradient(180deg, transparent 0%, ${t.bg} 92%)` }} />
        </div>
      )}

      {/* computer: who it's from, along the top */}
      <motion.header className="relative mx-auto hidden max-w-6xl items-center justify-between px-6 pt-8 lg:flex"
        initial={{ opacity: 0, y: -10 }} animate={showEnvelope ? { opacity: 0 } : { opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="flex items-center gap-3">
          <Avatar photo={inv.agent.photo_url} name={inv.agent.name} accent={accent} size={44} t={t} />
          <div>
            <p className="text-[15px] font-black" style={{ fontFamily: SERIF }}>{inv.agent.name}</p>
            <p className="text-[12px] font-semibold" style={{ color: t.sub }}>{quietLine(inv.agent)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Countdown date={days[0]?.date} accent={accent} t={t} />
          {inv.agent.logo_url && <img src={resolveMediaUrl(inv.agent.logo_url)} alt="" className="h-10 max-w-[140px] object-contain" />}
        </div>
      </motion.header>

      {/* phone: who it's from + how soon, above the card */}
      <motion.div className="relative mx-auto flex max-w-[520px] items-center justify-between gap-3 px-4 pt-4 lg:hidden"
        initial={{ opacity: 0, y: -8 }} animate={showEnvelope ? { opacity: 0 } : { opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar photo={inv.agent.photo_url} name={inv.agent.name} accent={accent} size={36} t={t} />
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.24em]" style={foilText(t, accent)}>An invitation from</p>
            <p className="truncate text-[14px] font-black leading-tight" style={{ fontFamily: SERIF }}>{inv.agent.name}</p>
          </div>
        </div>
        <Countdown date={days[0]?.date} accent={accent} t={t} small />
      </motion.div>

      <main className="relative mx-auto max-w-6xl px-4 pb-32 pt-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_460px] lg:items-start lg:gap-16 lg:pb-20 lg:pt-10">
        {/* ---- the card */}
        <motion.section className="lg:sticky lg:top-10"
          initial={skipEnvelope ? { opacity: 0, y: 14 } : { opacity: 0, y: -30, scale: 0.94 }}
          animate={showEnvelope ? { opacity: 0 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 140, damping: 20 }}>
          <TiltCard luxe={luxe} m={m}>
            <InviteCard data={cardData} />
          </TiltCard>
          {luxe && (
            <motion.p className="mt-5 hidden text-center text-[11px] font-black uppercase tracking-[0.42em] lg:block" style={foilText(t, accent)}
              initial={{ opacity: 0 }} animate={showEnvelope ? { opacity: 0 } : { opacity: 1 }} transition={{ delay: 0.8 }}>
              <span className="ip-foil-anim inline-block" style={foilText(t, accent)}>A private invitation</span>
            </motion.p>
          )}
        </motion.section>

        {/* ---- everything else */}
        <motion.div className="mx-auto mt-6 max-w-[520px] space-y-4 lg:mt-0"
          initial={{ opacity: 0, y: 24 }} animate={showEnvelope ? { opacity: 0 } : { opacity: 1, y: 0 }} transition={{ delay: skipEnvelope ? 0.05 : 0.25, type: 'spring', stiffness: 160, damping: 22 }}>

          {inv.message && (
            <Panel t={t}>
              <div className="flex gap-3">
                <Avatar photo={inv.agent.photo_url} name={inv.agent.name} accent={accent} size={40} t={t} />
                <div className="min-w-0">
                  <p className="text-[15px] leading-relaxed" style={{ fontFamily: SERIF, fontStyle: 'italic' }}>&ldquo;{inv.message}&rdquo;</p>
                  <p className="mt-1.5 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: t.sub }}>{inv.agent.name}</p>
                </div>
              </div>
            </Panel>
          )}

          {/* RSVP - becomes the calendar card once they've answered */}
          <div ref={rsvpRef} className="scroll-mt-6" id="rsvp">
            <Panel t={t} accent={accent} strong>
              <AnimatePresence mode="wait" initial={false}>
                {justSent ? (
                  <SentMoment key="sent" rsvp={justSent} inv={inv} days={myDays} accent={accent} t={t} onChange={() => { setJustSent(null); pick(justSent.response) }} onDone={() => setJustSent(null)} />
                ) : responded && !flow ? (
                  <motion.div key="mine" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} data-testid="invite-my-rsvp">
                    <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={foilText(t, accent)}>Your RSVP</p>
                    <div className="mt-2 flex items-center gap-3">
                      <ResponseBadge response={mine!.response} accent={accent} t={t} />
                      <div className="min-w-0">
                        <p className="text-lg font-black" style={{ fontFamily: SERIF }}>
                          {mine!.response === 'yes' ? "You're on the list" : mine!.response === 'maybe' ? "You're a maybe" : "You can't make it"}
                        </p>
                        <p className="text-sm" style={{ color: t.sub }}>
                          {mine!.name}{mine!.response !== 'no' && mine!.guest_count > 1 ? ` · party of ${mine!.guest_count}` : ''}{mine!.response !== 'no' && days.length > 1 && mine!.days?.length ? ` · ${daysText(myDays)}` : ''}
                        </p>
                      </div>
                    </div>
                    {mine!.response !== 'no' && !past && <CalendarButtons inv={inv} t={t} days={myDays} />}
                    {!closed && !past && (
                      <button type="button" onClick={() => pick(mine!.response)} data-testid="invite-change-rsvp"
                        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full px-4 text-[12px] font-black uppercase tracking-widest transition"
                        style={{ border: `1.5px solid ${t.luxe ? t.m!.base : accent}`, color: t.dark ? mix(t.luxe ? t.m!.light : accent, '#ffffff', 0.25) : mix(accent, '#000000', 0.2) }}>
                        <Pencil className="h-3.5 w-3.5" /> Change my RSVP
                      </button>
                    )}
                  </motion.div>
                ) : (closed || past) && !flow ? (
                  <motion.div key="closed" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={foilText(t, accent)}>RSVP</p>
                    <p className="mt-1 text-xl font-black" style={{ fontFamily: SERIF }}>{past ? 'This event has passed' : 'RSVPs are closed'}</p>
                    <p className="mt-1 text-sm" style={{ color: t.sub }}>{past ? 'Thanks for your interest!' : `Reach out to ${inv.agent.name || 'the host'} if you'd still like to come.`}</p>
                  </motion.div>
                ) : (
                  <motion.div key="ask" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} data-testid="invite-rsvp-form">
                    <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={foilText(t, accent)}>RSVP</p>
                    <h2 className="mt-1 text-2xl font-black" style={{ fontFamily: SERIF, fontStyle: t.luxe ? 'italic' : 'normal' }}>{mine ? 'Change your answer' : 'Will you be there?'}</h2>
                    <Choices value={flow} onPick={pick} accent={accent} t={t} />
                    {/* computer: the questions right here, one at a time */}
                    {!phone && flow && (
                      <div className="mt-5">
                        <RsvpFlow response={flow} inv={inv} initial={mine} t={t} accent={accent} onSent={onSent} onCancel={() => setFlow(null)} />
                      </div>
                    )}
                    {mine && !flow && <button type="button" onClick={() => setFlow(null)} className="mt-3 text-[12px] font-bold" style={{ color: t.sub }}>Cancel</button>}
                  </motion.div>
                )}
              </AnimatePresence>
            </Panel>
          </div>

          {/* When - its calendar buttons only until they've answered (then the RSVP card has them) */}
          <motion.div {...reveal(0)}>
            <Panel t={t}>
              <Row icon={<CalendarDays className="h-5 w-5" />} accent={accent} t={t} label={days.length > 1 ? `When · ${days.length} days` : 'When'}>
                {days.length <= 1 ? (
                  <>
                    <p className="text-[16px] font-black">{dayLong(days[0]?.date) || 'Date to come'}</p>
                    {days[0]?.start && <p className="text-sm" style={{ color: t.sub }}><Clock className="mr-1 inline h-3.5 w-3.5" />{clockRange(days[0].start, days[0].end)}</p>}
                  </>
                ) : showCal ? (
                  // the day columns below say each day + its hours - no second list up here
                  <p className="text-[16px] font-black">{days.length === 2 ? days.map(d => parseDay(d.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })).join(' & ') : `${parseDay(days[0].date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} + ${days.length - 1} more days`}</p>
                ) : (
                  <div className="mt-0.5 space-y-1">
                    {days.map(d => (
                      <p key={d.date} className="text-[15px] font-black">{dayLong(d.date)} <span className="text-sm font-semibold" style={{ color: t.sub }}>· {clockRange(d.start, d.end)}</span></p>
                    ))}
                  </div>
                )}
              </Row>
              {showCal && <CalendarButtons inv={inv} t={t} days={days} />}
            </Panel>
          </motion.div>

          {/* Where */}
          {(inv.place_name || inv.address) && (
            <motion.div {...reveal(1)}>
              <Panel t={t}>
                <Row icon={<MapPin className="h-5 w-5" />} accent={accent} t={t} label="Where">
                  {inv.place_name && <p className="text-[16px] font-black">{inv.place_name}</p>}
                  {inv.address && <p className={inv.place_name ? 'text-sm' : 'text-[16px] font-black'} style={inv.place_name ? { color: t.sub } : undefined}>{inv.address}</p>}
                  {(details?.township || details?.school_district) && (
                    <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: t.sub }}>{[details.township ? `${details.township} Township` : null, details.school_district ? `${details.school_district} schools` : null].filter(Boolean).join(' · ')}</p>
                  )}
                </Row>
                {details?.latitude != null && details?.longitude != null && (
                  <LazyMap lat={Number(details.latitude)} lng={Number(details.longitude)} address={inv.address} accent={t.luxe ? t.m!.base : accent} dark={t.dark} />
                )}
                {inv.address && (
                  <button type="button" onClick={() => openDirections(inv.address!, { label: inv.place_name || inv.address! })} data-testid="invite-directions"
                    className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[12px] font-black uppercase tracking-widest transition active:scale-[0.98]"
                    style={{ background: soft(t), color: t.text }}>
                    <Navigation className="h-4 w-4" style={{ color: t.luxe ? t.m!.light : accent }} /> Get directions
                  </button>
                )}
              </Panel>
            </motion.div>
          )}

          {/* The home - the Guest Pass's photo card (photos turning by themselves + the numbers) */}
          {isHome && (
            <motion.div {...reveal(2)}>
              <HomeShowcase inv={inv} t={t} accent={accent} />
            </motion.div>
          )}
          {/* About the home: the highlights, key facts and schools (owner, 10/24: "super empty") */}
          {details && (details.highlights || details.description || details.facts.length > 0) && (
            <motion.div {...reveal(2)}>
              <AboutHome d={details} t={t} accent={accent} street={(inv.linked_property?.address || '').split(',')[0]} />
            </motion.div>
          )}

          {/* The Guest Pass's three + Stay updated */}
          {isHome && inv.audience === 'clients' && (
            <motion.div {...reveal(3)}>
              <GuestTools inv={inv} t={t} accent={accent} requested={requested} canCheat={!!inv.cheat_sheet}
                onCheat={() => setCheat(true)} onAsk={k => setAsk(k)} />
            </motion.div>
          )}

          {/* Host - a proper introduction (owner, 10/24 round 2) */}
          <motion.div {...reveal(4)}>
            <Panel t={t}>
              <p className="text-center text-[10px] font-black uppercase tracking-[0.26em]" style={foilText(t, accent)}>Your host</p>
              <div className="mt-4 flex flex-col items-center text-center">
                <span className="relative">
                  <span aria-hidden className="absolute -inset-2 rounded-full" style={{ background: t.luxe ? `conic-gradient(${t.m!.deep}, ${t.m!.light}, ${t.m!.pale}, ${t.m!.base}, ${t.m!.deep})` : mix(accent, t.dark ? '#000000' : '#ffffff', 0.6), opacity: t.luxe ? 0.9 : 1 }} />
                  <span className="relative block rounded-full p-1" style={{ background: t.surface }}><Avatar photo={inv.agent.photo_url} name={inv.agent.name} accent={accent} size={92} t={t} /></span>
                </span>
                <p className="mt-4 text-[24px] font-black leading-tight" style={{ fontFamily: SERIF }}>{inv.agent.name}</p>
                <p className="mt-0.5 text-sm" style={{ color: t.sub }}>{quietLine(inv.agent)}</p>
                {inv.agent.logo_url && <img src={resolveMediaUrl(inv.agent.logo_url)} alt="" className="mt-3 h-9 max-w-[140px] object-contain" />}
                <p className="mt-3 max-w-sm text-[14px] leading-relaxed" style={{ fontFamily: SERIF, fontStyle: 'italic', color: t.dark ? 'rgba(255,255,255,.82)' : t.text }}>
                  &ldquo;{isHome ? `I'll be at the door to welcome you - ask me anything about the home, the neighborhood or the market.` : `I can't wait to see you there - reach out any time with a question.`}&rdquo;
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {inv.agent.phone && <ContactBtn href={`tel:${inv.agent.phone.replace(/[^\d+]/g, '')}`} icon={<Phone className="h-4 w-4" />} label="Call" t={t} accent={accent} />}
                {(inv.agent.text_phone || inv.agent.phone) && <ContactBtn href={`sms:${(inv.agent.text_phone || inv.agent.phone).replace(/[^\d+]/g, '')}`} icon={<MessageSquare className="h-4 w-4" />} label="Text" t={t} accent={accent} />}
                {inv.agent.email && <ContactBtn href={`mailto:${inv.agent.email}?subject=${encodeURIComponent(inv.title)}`} icon={<Mail className="h-4 w-4" />} label="Email" t={t} accent={accent} />}
              </div>
            </Panel>
          </motion.div>
        </motion.div>
      </main>

      {/* phone: the RSVP button stays in reach */}
      {!showEnvelope && !closed && !past && !justSent && !flow && (
        <div className={`fixed inset-x-0 bottom-0 z-40 px-4 pt-3 transition duration-300 lg:hidden ${rsvpInView ? 'pointer-events-none translate-y-full opacity-0' : ''}`} style={{ paddingBottom: 'max(0.9rem, env(safe-area-inset-bottom))', background: `linear-gradient(180deg, transparent, ${t.bg} 40%)` }}>
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={goRsvp} data-testid="invite-rsvp-bar"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-black uppercase tracking-widest shadow-[0_18px_34px_-14px_rgba(0,0,0,.55)]"
            style={btnStyle(t, accent)}>
            {responded ? <>Your RSVP: {mine!.response === 'yes' ? 'Coming' : mine!.response === 'maybe' ? 'Maybe' : "Can't make it"} <ChevronDown className="h-4 w-4" /></> : <>RSVP <ChevronDown className="h-4 w-4" /></>}
          </motion.button>
        </div>
      )}

      {/* phone: the RSVP questions in a pull-up, one at a time */}
      <ThemedSheet open={phone && !!flow} onClose={() => setFlow(null)} t={t} label="RSVP">
        {flow && <RsvpFlow response={flow} inv={inv} initial={mine} t={t} accent={accent} onSent={onSent} onCancel={() => setFlow(null)} inSheet onSwitch={r => setFlow(r)} />}
      </ThemedSheet>
      <ThemedSheet open={!!ask} onClose={() => setAsk(null)} t={t} label="Request">
        {ask && <RequestFlow kind={ask} inv={inv} mine={mine} t={t} accent={accent} done={!!requested[ask]} onSend={sendRequest} onClose={() => setAsk(null)} />}
      </ThemedSheet>
      {cheat && inv.cheat_sheet && (
        <CheatOverlay inv={inv} accent={accent} requested={requested} onClose={() => setCheat(false)}
          onRequest={k => { setCheat(false); setAsk(k === 'second_visit' ? 'second_tour' : 'disclosure') }} />
      )}
    </div>
  )
}

// ------------------------------------------------------------------ the Luxe room behind the page

function LuxeBackdrop({ m }: { m: MetalPalette }) {
  const dust = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const r = (k: number) => { const x = Math.sin((i + 1) * 12.9898 * k + 78.233) * 43758.5453; return x - Math.floor(x) }
    return { left: r(1) * 100, top: r(2) * 100, size: 1 + Math.round(r(3) * 2.2), delay: r(4) * 9, dur: 9 + r(5) * 9 }
  }), [])
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ ['--mr' as any]: m.rgb, ['--ml' as any]: m.lightRgb, ['--mp' as any]: m.pale }}>
      <div className="ip-aur ip-aur1" />
      <div className="ip-aur ip-aur2" />
      <div className="ip-aur ip-aur3" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(90% 70% at 50% 40%, transparent 30%, rgba(0,0,0,.65) 100%)' }} />
      {dust.map((d, i) => <span key={i} className="ip-dust" style={{ left: `${d.left}%`, top: `${d.top}%`, width: d.size, height: d.size, animationDelay: `${d.delay}s`, ['--d' as any]: `${d.dur}s` }} />)}
    </div>
  )
}

// ------------------------------------------------------------------ pieces

/** On a computer the card leans toward the mouse, like holding a real one. Luxe: it also floats
 *  and a light passes over it now and then. Transforms only. */
function TiltCard({ children, luxe, m }: { children: React.ReactNode; luxe?: boolean; m?: MetalPalette | null }) {
  const rx = useMotionValue(0)
  const ry = useMotionValue(0)
  const sx = useSpring(rx, { stiffness: 140, damping: 16 })
  const sy = useSpring(ry, { stiffness: 140, damping: 16 })
  const glare = useTransform(sy, [-8, 8], ['20%', '80%'])
  const glareBg = useTransform(glare, g => `linear-gradient(115deg, transparent 0%, rgba(255,255,255,.0) calc(${g} - 18%), rgba(255,255,255,.22) ${g}, rgba(255,255,255,0) calc(${g} + 18%), transparent 100%)`)
  return (
    <div className="mx-auto max-w-[420px] lg:max-w-[460px]" style={{ perspective: 1200 }}
      onMouseMove={e => {
        if (window.matchMedia('(hover: none)').matches) return
        const r = e.currentTarget.getBoundingClientRect()
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 12)
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 10)
      }}
      onMouseLeave={() => { rx.set(0); ry.set(0) }}>
      <motion.div style={{ rotateX: sx, rotateY: sy, transformStyle: 'preserve-3d', boxShadow: luxe && m ? `0 50px 90px -40px rgba(0,0,0,.95), 0 0 70px -20px rgba(${m.rgb},.55)` : undefined, borderRadius: 14 }} className="relative">
        {children}
        <motion.div aria-hidden className="pointer-events-none absolute inset-0 hidden rounded-[14px] lg:block" style={{ background: glareBg }} />
        {luxe && <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[14px]"><span className="ip-cardsweep" /></div>}
      </motion.div>
    </div>
  )
}

function Countdown({ date, accent, t, small = false }: { date?: string | null; accent: string; t: Theme; small?: boolean }) {
  if (!date) return null
  const [y, mo, d] = date.split('-').map(Number)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const n = Math.round((new Date(y, mo - 1, d).getTime() - today.getTime()) / 86400000)
  if (n < 0) return null
  const label = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`
  return (
    <span className={`inline-flex shrink-0 items-center gap-2 rounded-full font-black uppercase ${small ? "h-8 px-3 text-[10px] tracking-[0.14em]" : "h-10 px-4 text-[12px] tracking-[0.18em]"}`} style={{ background: t.surface, border: `1px solid ${t.luxe ? t.border : mix(accent, t.dark ? '#000000' : '#ffffff', 0.3)}`, color: t.text }}>
      <span className="h-2 w-2 rounded-full" style={{ background: t.luxe ? t.m!.light : accent }} /> {label}
    </span>
  )
}

function Panel({ t, children, accent, strong = false }: { t: Theme; children: React.ReactNode; accent?: string; strong?: boolean }) {
  if (t.luxe) {
    return (
      <section className={`ip-lux-panel relative overflow-hidden rounded-[22px] p-5 sm:p-6 ${strong ? 'ip-lux-strong' : ''}`} style={{ background: t.surface, border: `1px solid ${t.border}` }}>
        <span aria-hidden className="ip-lux-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
        <div className="relative">{children}</div>
      </section>
    )
  }
  return (
    <section className="rounded-[22px] p-5 sm:p-6" style={{ background: t.surface, border: `1px solid ${strong && accent ? mix(accent, t.dark ? '#000000' : '#ffffff', 0.35) : t.border}`, boxShadow: t.dark ? 'none' : '0 18px 40px -32px rgba(60,45,20,.45)' }}>
      {children}
    </section>
  )
}

function Row({ icon, accent, label, t, children }: { icon: React.ReactNode; accent: string; label: string; t: Theme; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={t.luxe ? { background: `rgba(${t.m!.rgb},.14)`, color: t.m!.light, boxShadow: `inset 0 0 0 1px rgba(${t.m!.rgb},.3)` } : { background: mix(accent, '#ffffff', 0.82), color: mix(accent, '#000000', 0.25) }}>{icon}</span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={foilText(t, accent)}>{label}</p>
        {children}
      </div>
    </div>
  )
}

function Avatar({ photo, name, accent, size, t }: { photo?: string | null; name?: string | null; accent: string; size: number; t: Theme }) {
  const ring = t.luxe ? t.m!.light : accent
  return photo
    ? <img src={resolveMediaUrl(photo)} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size, boxShadow: `0 0 0 2px ${ring}` }} />
    : <span className="grid shrink-0 place-items-center rounded-full font-black" style={{ width: size, height: size, fontSize: size * 0.36, ...btnStyle(t, accent), boxShadow: 'none' }}>{initialsOf(name)}</span>
}

function ContactBtn({ href, icon, label, t, accent }: { href: string; icon: React.ReactNode; label: string; t: Theme; accent: string }) {
  return (
    <a href={href} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition active:scale-[0.97]"
      style={{ background: soft(t), color: t.text }}>
      <span style={{ color: t.luxe ? t.m!.light : accent }}>{icon}</span>{label}
    </a>
  )
}

/** "GMT-4" -> "-04:00" for a day's Eastern wall-clock time (Outlook wants a real offset). */
function easternOffset(date: string, hm: string) {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' })
      .formatToParts(new Date(`${date}T${hm}:00Z`)).find(p => p.type === 'timeZoneName')?.value || 'GMT-5'
    const m = part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
    return m ? `${m[1]}${m[2].padStart(2, '0')}:${m[3] || '00'}` : '-05:00'
  } catch { return '-05:00' }
}
function outlookUrl(inv: PublicInvite, d: InviteDay, link: string) {
  const start = d.start || '18:00'
  const [h, mi] = start.split(':').map(Number)
  const end = d.end || `${String(Math.min(23, h + 2)).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
  const off = easternOffset(d.date, start)
  const q = new URLSearchParams({ rru: 'addevent', path: '/calendar/action/compose', subject: inv.title,
    startdt: `${d.date}T${start}:00${off}`, enddt: `${d.date}T${end}:00${off}`,
    location: [inv.place_name, inv.address].filter(Boolean).join(', '), body: [inv.message, link].filter(Boolean).join('\n\n') })
  return `https://outlook.live.com/calendar/0/action/compose?${q.toString()}`
}

/** Add to calendar (owner, 10/24 round 2): one column per day - side by side for two, wrapping for
 *  three or more, centred for one - and under each day three logo buttons: Google, Apple, Outlook. */
function CalendarButtons({ inv, t, days }: { inv: PublicInvite; t: Theme; days: InviteDay[] }) {
  const link = typeof window !== 'undefined' ? window.location.href.split('?')[0] : inv.share_url
  const list = days.filter(Boolean)
  const n = list.length
  const cols = n <= 1 ? 'grid-cols-1 max-w-[260px] mx-auto' : n === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
  const tile = 'grid h-10 w-10 place-items-center rounded-xl transition hover:-translate-y-0.5 active:scale-95 sm:h-12 sm:w-12 sm:rounded-2xl'
  const tileStyle: React.CSSProperties = { background: t.dark ? 'rgba(255,255,255,.94)' : '#ffffff', boxShadow: t.dark ? '0 10px 22px -14px rgba(0,0,0,.9)' : '0 8px 18px -12px rgba(60,45,20,.45)', border: `1px solid ${t.dark ? 'transparent' : t.border}` }
  return (
    <div className="mt-4" data-testid="invite-calendar">
      <p className="mb-2.5 text-center text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: t.sub }}>Add to your calendar</p>
      <div className={`grid gap-2.5 ${cols}`}>
        {list.map(d => {
          const dt = parseDay(d.date)
          const label = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
          return (
            <div key={d.date} className="flex min-w-0 flex-col items-center rounded-[20px] px-2 py-3 text-center" style={{ background: soft(t) }} data-testid="invite-cal-day">
              <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: t.sub }}>{dt.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="text-[17px] font-black leading-tight" style={{ fontFamily: SERIF }}>{dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              {d.start && <span className="text-[11.5px] font-bold" style={{ color: t.sub }}>{clockRange(d.start, d.end)}</span>}
              <div className="mt-2.5 flex gap-1.5 sm:gap-2">
                <a href={googleCalendarUrl(inv, link, d)} target="_blank" rel="noopener noreferrer" className={tile} style={tileStyle} aria-label={`Add ${label} to Google Calendar`} title="Google Calendar" data-testid="invite-cal-google"><GoogleMark /></a>
                <a href={icsUrl(inv.code, [d.date])} className={tile} style={tileStyle} aria-label={`Add ${label} to Apple Calendar`} title="Apple Calendar" data-testid="invite-cal-apple"><AppleMark day={dt.getDate()} wk={dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()} /></a>
                <a href={outlookUrl(inv, d, link)} target="_blank" rel="noopener noreferrer" className={tile} style={tileStyle} aria-label={`Add ${label} to Outlook`} title="Outlook" data-testid="invite-cal-outlook"><OutlookMark /></a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
/** The three calendars' marks (drawn here - logos only, no words, owner 10/24). */
const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
    <rect x="6" y="6" width="36" height="36" rx="5" fill="#fff" />
    <path d="M6 14V11a5 5 0 0 1 5-5h26a5 5 0 0 1 5 5v3z" fill="#4285F4" />
    <path d="M42 34v3a5 5 0 0 1-5 5H34V34z" fill="#EA4335" />
    <path d="M6 34h28v8H11a5 5 0 0 1-5-5z" fill="#34A853" opacity=".95" />
    <path d="M34 14h8v20h-8z" fill="#FBBC04" />
    <path d="M6 14h28v20H6z" fill="#fff" />
    <text x="20" y="31" textAnchor="middle" fontSize="15" fontWeight="700" fill="#4285F4" fontFamily="Arial, sans-serif">31</text>
  </svg>
)
const AppleMark = ({ day, wk }: { day: number; wk: string }) => (
  <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
    <rect x="5" y="5" width="38" height="38" rx="9" fill="#fff" stroke="#e5e5ea" />
    <text x="24" y="17" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#FF3B30" fontFamily="-apple-system, Helvetica, Arial, sans-serif">{wk}</text>
    <text x="24" y="37" textAnchor="middle" fontSize="19" fontWeight="400" fill="#111" fontFamily="-apple-system, Helvetica, Arial, sans-serif">{day}</text>
  </svg>
)
const OutlookMark = () => (
  <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden>
    <rect x="16" y="8" width="26" height="32" rx="4" fill="#28A8EA" />
    <path d="M16 24h26v12a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4z" fill="#0078D4" />
    <path d="M16 24l13 8 13-8" fill="none" stroke="#50D9FF" strokeWidth="1.6" />
    <rect x="5" y="13" width="22" height="22" rx="3.5" fill="#0F6CBD" />
    <ellipse cx="16" cy="24" rx="5.4" ry="6.6" fill="none" stroke="#fff" strokeWidth="2.8" />
  </svg>
)

function ResponseBadge({ response, accent, t }: { response: RsvpResponse; accent: string; t: Theme }) {
  const Icon = response === 'yes' ? Check : response === 'maybe' ? HelpCircle : X
  const st: React.CSSProperties = response === 'yes' ? btnStyle(t, accent) : response === 'maybe' ? { background: mix(t.luxe ? t.m!.base : accent, '#ffffff', 0.6), color: '#111827' } : { background: '#9ca3af', color: '#111827' }
  return <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ ...st, boxShadow: 'none' }}><Icon className="h-6 w-6" strokeWidth={3} /></span>
}

const CHOICES: { id: RsvpResponse; label: string; icon: typeof Check }[] = [
  { id: 'yes', label: "I'll be there", icon: Check },
  { id: 'maybe', label: 'Maybe', icon: HelpCircle },
  { id: 'no', label: "Can't make it", icon: X },
]

const CHOICE_ORDER: RsvpResponse[] = CHOICES.map(c => c.id)

/** The questions slide in the direction of travel - Next/Back, or the new choice when the guest
 *  switches answer partway (custom = -1 | 1, read by the exiting step too). */
const STEP_SLIDE = {
  enter: (d: number) => ({ opacity: 0, x: d * 40 }),
  center: { opacity: 1, x: 0 },
  // the old question is gone before the new one slides in - never text over text (10/31)
  exit: (d: number) => ({ opacity: 0, x: d * -24, transition: { duration: 0.11, ease: 'easeIn' as const } }),
}

/** Nothing picked until the guest taps one; switching slides the highlight across to the new
 *  choice (owner, 10/31). */
function Choices({ value, onPick, accent, t }: { value: RsvpResponse | null; onPick: (r: RsvpResponse) => void; accent: string; t: Theme }) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {CHOICES.map(c => {
        const on = value === c.id
        return (
          <motion.button key={c.id} type="button" whileTap={{ scale: 0.95 }} onClick={() => onPick(c.id)} data-testid={`rsvp-${c.id}`} aria-pressed={on}
            className="relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl px-1 text-center text-[12px] font-black transition-colors duration-200"
            style={{ background: t.dark ? 'rgba(255,255,255,.05)' : '#ffffff', border: `1px solid ${t.border}`, color: on ? (t.luxe ? '#17140f' : onAccent(accent)) : t.text }}>
            {on && <motion.span layoutId="rsvp-choice-pill" aria-hidden className="absolute inset-0 rounded-2xl" style={{ ...btnStyle(t, accent), boxShadow: 'none' }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
            <c.icon className="relative h-6 w-6" strokeWidth={2.6} />
            <span className="relative">{c.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

/** The Guest Pass's home card: photos that turn by themselves (swipe or the arrows to take over),
 *  the price + address over them, and the numbers underneath. */
function HomeShowcase({ inv, t, accent }: { inv: PublicInvite; t: Theme; accent: string }) {
  const lp = inv.linked_property!
  const photos = useMemo(() => [coverOf(inv) ? (inv.cover_image_url || lp.image) : lp.image, ...(lp.photos || [])]
    .filter((p, i, a): p is string => !!p && a.indexOf(p) === i).slice(0, 12), [inv, lp])
  const strip = useRef<HTMLDivElement>(null)
  const idxRef = useRef(0)
  const [idx, setIdx] = useState(0)
  const [auto, setAuto] = useState(true)
  const n = photos.length
  const go = (i: number) => {
    const el = strip.current
    if (!el || n < 2) return
    const k = (i + n) % n
    idxRef.current = k
    el.scrollTo({ left: k * el.clientWidth, behavior: 'smooth' })
  }
  useEffect(() => {
    if (!auto || n < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const tm = window.setInterval(() => go(idxRef.current + 1), 4200)
    return () => window.clearInterval(tm)
  }, [auto, n]) // eslint-disable-line react-hooks/exhaustive-deps
  const price = lp.price ? `$${Math.round(lp.price).toLocaleString('en-US')}` : ''
  const street = (lp.address || '').split(',')[0]
  const town = [lp.city, lp.state].filter(Boolean).join(', ')
  const facts = [
    lp.beds ? { icon: Bed, v: lp.beds, l: 'Beds' } : null,
    lp.baths ? { icon: Bath, v: lp.baths, l: 'Baths' } : null,
    lp.sqft ? { icon: Ruler, v: Math.round(lp.sqft).toLocaleString('en-US'), l: 'Sq Ft' } : null,
  ].filter(Boolean) as { icon: typeof Bed; v: number | string; l: string }[]
  const ink = t.luxe ? t.m!.light : accent
  return (
    <section className="overflow-hidden rounded-[24px]" style={{ background: t.surface, border: `1px solid ${t.border}`, boxShadow: t.dark ? 'none' : '0 22px 50px -34px rgba(60,45,20,.55)' }} data-testid="invite-home">
      <div className="relative">
        <div ref={strip} onScroll={() => { const el = strip.current; if (!el) return; const k = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); idxRef.current = k; setIdx(k) }}
          onTouchStart={() => setAuto(false)} onWheel={() => setAuto(false)}
          className="flex aspect-[16/10] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(n ? photos : ['']).map((p, i) => (
            <div key={i} className="relative h-full w-full shrink-0 snap-center" style={{ background: soft(t) }}>
              {p && <img src={sizedImage(resolveMediaUrl(p), 1080, 75)} alt={i === 0 ? street : ''} loading={i < 2 ? 'eager' : 'lazy'} className="h-full w-full object-cover" />}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        {n > 1 && (
          <>
            <button type="button" onClick={() => { setAuto(false); go(idxRef.current - 1) }} aria-label="Previous photo" className="absolute left-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white transition hover:bg-black/60 active:scale-95"><ChevronLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => { setAuto(false); go(idxRef.current + 1) }} aria-label="Next photo" className="absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/40 text-white transition hover:bg-black/60 active:scale-95"><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0 text-white">
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/75">The home</p>
            {price && <p className="text-[26px] font-black leading-tight tracking-tight">{price}</p>}
            <p className="truncate text-sm font-bold text-white/85">{street}{town ? `, ${town}` : ''}</p>
          </div>
          {n > 1 && <span className="shrink-0 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-black tracking-widest text-white">{idx + 1} / {n}</span>}
        </div>
      </div>
      {facts.length > 0 && (
        <div className="grid grid-cols-3" style={{ borderTop: `1px solid ${t.border}` }}>
          {facts.map((f, i) => (
            <div key={f.l} className="flex flex-col items-center gap-0.5 py-3" style={i ? { borderLeft: `1px solid ${t.border}` } : undefined}>
              <span className="flex items-center gap-1.5 text-lg font-black tracking-tight"><f.icon className="h-4 w-4" style={{ color: ink }} />{f.v}</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: t.sub }}>{f.l}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** Cheat Sheet · Seller disclosure · Second tour - and Stay updated (the Guest Pass's). */
function GuestTools({ inv, t, accent, requested, canCheat, onCheat, onAsk }: {
  inv: PublicInvite; t: Theme; accent: string; requested: Record<string, boolean>; canCheat: boolean; onCheat: () => void; onAsk: (k: InviteRequestKind) => void
}) {
  const first = inv.agent.first_name || inv.agent.name.split(' ')[0] || 'the host'
  const ink = t.luxe ? t.m!.light : accent
  const tiles = [
    canCheat ? { k: 'cheat', icon: FileText, eyebrow: 'Guide', title: 'Cheat Sheet', body: 'Schools, taxes & nearby', on: onCheat } : null,
    { k: 'disclosure', icon: ScanSearch, eyebrow: 'One tap', title: 'Seller Disclosure', body: requested.disclosure ? 'Requested' : `Get it from ${first}`, on: () => onAsk('disclosure') },
    { k: 'second_tour', icon: CalendarCheck, eyebrow: 'One tap', title: 'Second Tour', body: requested.second_tour ? 'Requested' : 'See it again, just you', on: () => onAsk('second_tour') },
  ].filter(Boolean) as { k: string; icon: typeof FileText; eyebrow: string; title: string; body: string; on: () => void }[]
  return (
    <div data-testid="invite-guest-tools">
      <div className={`grid gap-2.5 ${tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {tiles.map((x, i) => {
          const done = x.k !== 'cheat' && requested[x.k]
          return (
            <motion.button key={x.k} type="button" onClick={x.on} whileTap={{ scale: 0.97 }} data-testid={`invite-tool-${x.k}`}
              initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex min-h-[132px] flex-col items-start overflow-hidden rounded-[22px] p-3 text-left transition sm:p-4"
              style={{ background: t.surface, border: `1px solid ${done ? 'rgba(16,185,129,.4)' : t.border}` }}>
              <span className="mb-2 grid h-10 w-10 place-items-center rounded-2xl" style={done ? { background: 'rgba(16,185,129,.12)', color: '#059669' } : { background: t.luxe ? `rgba(${t.m!.rgb},.14)` : mix(accent, t.dark ? '#000000' : '#ffffff', 0.85), color: ink }}>
                {done ? <Check className="h-5 w-5" strokeWidth={3} /> : <x.icon className="h-5 w-5" />}
              </span>
              <span className="text-[8.5px] font-black uppercase tracking-[0.2em]" style={foilText(t, accent)}>{x.eyebrow}</span>
              <span className="mt-0.5 text-[14px] font-black leading-tight">{x.title}</span>
              <span className="mt-1 text-[11px] font-semibold leading-snug" style={{ color: done ? '#059669' : t.sub }}>{x.body}</span>
            </motion.button>
          )
        })}
      </div>
      <motion.button type="button" onClick={() => onAsk('updates')} whileTap={{ scale: 0.98 }} data-testid="invite-tool-updates"
        className="mt-2.5 flex w-full items-center gap-3 rounded-[22px] p-4 text-left"
        style={{ background: t.surface, border: `1px solid ${requested.updates ? 'rgba(16,185,129,.4)' : t.border}` }}>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${requested.updates ? '' : 'ip-bell'}`} style={requested.updates ? { background: 'rgba(16,185,129,.12)', color: '#059669' } : { ...btnStyle(t, accent), boxShadow: 'none' }}>
          {requested.updates ? <Check className="h-5 w-5" strokeWidth={3} /> : <BellRing className="h-5 w-5" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-black">{requested.updates ? "You're following this home" : 'Stay updated'}</span>
          <span className="block text-[12px] font-semibold" style={{ color: t.sub }}>{requested.updates ? "You'll hear about price changes and new open houses." : 'Price changes, new open houses, under contract - nothing else.'}</span>
        </span>
        {!requested.updates && <ChevronRight className="h-4 w-4 shrink-0" style={{ color: t.sub }} />}
      </motion.button>
      <p className="mt-2 text-center text-[11px] font-medium" style={{ color: t.sub }}>Requests go straight to {inv.agent.name}.</p>
    </div>
  )
}

// ------------------------------------------------------------------ about the home + where it is

type HomeDetails = {
  highlights?: string | null; description?: string | null
  facts: { label: string; value: string }[]
  schools: { level: string; name: string }[]
  school_district?: string | null; township?: string | null
  latitude?: number | null; longitude?: number | null
}

/** The listing's highlights (or description), its key facts as tiles and the assigned schools. */
function AboutHome({ d, t, accent, street }: { d: HomeDetails; t: Theme; accent: string; street: string }) {
  const [more, setMore] = useState(false)
  const text = d.highlights || d.description || ''
  const long = text.length > 260
  const ink = t.luxe ? t.m!.light : accent
  const tileBg = t.luxe ? `rgba(${t.m!.rgb},.08)` : t.dark ? 'rgba(255,255,255,.05)' : mix(accent, '#ffffff', 0.93)
  return (
    <Panel t={t}>
      <p className="text-[10px] font-black uppercase tracking-[0.26em]" style={foilText(t, accent)}>About the home</p>
      <h3 className="mt-1 text-[22px] font-black leading-tight" style={{ fontFamily: SERIF, fontStyle: t.luxe ? 'italic' : 'normal' }}>{tidy(street) || 'The home'}</h3>
      {text && (
        <div className="mt-3">
          <motion.div className="relative" initial={false} animate={{ height: more || !long ? 'auto' : 112 }} transition={{ type: 'spring', stiffness: 260, damping: 32 }} style={{ overflow: 'hidden' }}>
            <p className="text-[14.5px] leading-relaxed" style={{ color: t.dark ? 'rgba(255,255,255,.82)' : t.text }}>{text}</p>
            {long && !more && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10" style={{ background: `linear-gradient(180deg, transparent, ${t.luxe ? '#141316' : t.surface})` }} />}
          </motion.div>
          {long && (
            <button type="button" onClick={() => setMore(v => !v)} className="mt-1.5 text-[12px] font-black uppercase tracking-widest" style={{ color: ink }}>{more ? 'Show less' : 'Read more'}</button>
          )}
        </div>
      )}
      {d.facts.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="invite-facts">
          {d.facts.map((f, i) => (
            <motion.div key={f.label} className="rounded-2xl px-3 py-2.5" style={{ background: tileBg, border: `1px solid ${t.luxe ? t.border : 'transparent'}` }}
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.4 }}>
              <p className="text-[9.5px] font-black uppercase tracking-[0.18em]" style={{ color: t.sub }}>{f.label}</p>
              <p className="mt-0.5 text-[14px] font-black leading-snug">{f.value}</p>
            </motion.div>
          ))}
        </div>
      )}
      {d.schools.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: t.sub }}><GraduationCap className="h-3.5 w-3.5" style={{ color: ink }} /> Schools{d.school_district ? ` · ${d.school_district}` : ''}</p>
          <div className="space-y-1.5">
            {d.schools.map(s => (
              <div key={s.level} className="flex items-center gap-3 rounded-2xl px-3 py-2.5" style={{ background: tileBg }}>
                <span className="w-[74px] shrink-0 text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: ink }}>{s.level}</span>
                <span className="min-w-0 truncate text-[13.5px] font-bold">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  )
}
const tidy = (s: string) => (s && s === s.toUpperCase() ? s.toLowerCase().replace(/\b([a-z])/g, m => m.toUpperCase()) : s)

/** The map (township / school district lines, like the property pages) - loaded only once the guest
 *  scrolls near it, so a page that's never scrolled costs nothing. */
const HomeAreaMap = dynamic(() => import('@/components/maps/HomeAreaMap'), { ssr: false })
function LazyMap({ lat, lng, address, accent, dark }: { lat: number; lng: number; address?: string | null; accent: string; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setShow(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShow(true); io.disconnect() } }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="relative mt-4 h-[220px] overflow-hidden rounded-2xl sm:h-[260px]" style={{ background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.04)' }} data-testid="invite-map">
      {show && <HomeAreaMap latitude={lat} longitude={lng} address={address} accent={accent} dark={dark} rounded="rounded-2xl" />}
    </div>
  )
}

// ------------------------------------------------------------------ the pull-up (themed)

function ThemedSheet({ open, onClose, t, label, children }: { open: boolean; onClose: () => void; t: Theme; label: string; children: React.ReactNode }) {
  const [mount, setMount] = useState<HTMLElement | null>(null)
  useEffect(() => { setMount(document.body) }, [])
  const release = usePagePin(open)
  if (!mount) return null
  return createPortal(
    <AnimatePresence onExitComplete={release}>
      {open && <SheetBody key="s" onClose={onClose} t={t} label={label}>{children}</SheetBody>}
    </AnimatePresence>,
    mount,
  )
}

function SheetBody({ onClose, t, label, children }: { onClose: () => void; t: Theme; label: string; children: React.ReactNode }) {
  const phone = useIsPhone()
  const sheetMotion = useSheetMotion()
  const { sheetRef, y } = useSwipeToClose(onClose, phone)
  return (
    <motion.div {...backdropMotion} data-scroll-lock="off" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      className={`fixed inset-0 z-[90] flex bg-black/55 ${phone ? 'items-end' : 'items-center justify-center p-6'}`} role="dialog" aria-label={label}>
      <motion.div ref={sheetRef} {...sheetMotion} style={{ ...(phone ? { y } : {}), background: t.luxe ? '#0f0e10' : t.surface, color: t.text }}
        className={`relative flex w-full flex-col overflow-hidden shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] ${phone ? 'max-h-[90dvh] rounded-t-[28px]' : 'max-h-[min(760px,calc(100dvh-3rem))] max-w-lg rounded-[28px]'}`}>
        {t.luxe && <span aria-hidden className="ip-lux-edge pointer-events-none absolute inset-x-0 top-0 h-px" />}
        {phone && <span aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full" style={{ background: t.dark ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.15)' }} />}
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full" style={{ background: soft(t), color: t.sub }}><X className="h-4 w-4" /></button>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-7 sm:pt-6">{children}</div>
      </motion.div>
    </motion.div>
  )
}

/** Height that follows its content smoothly (no jump when a step is taller or shorter). */
function AutoHeight({ children }: { children: React.ReactNode }) {
  const inner = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number | 'auto'>('auto')
  useLayoutEffect(() => {
    const el = inner.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setH(el.offsetHeight))
    ro.observe(el)
    setH(el.offsetHeight)
    return () => ro.disconnect()
  }, [])
  return (
    <motion.div animate={{ height: h }} transition={{ type: 'spring', stiffness: 320, damping: 34 }} style={{ overflow: 'hidden' }}>
      <div ref={inner}>{children}</div>
    </motion.div>
  )
}

// ------------------------------------------------------------------ the RSVP, one question at a time

type Step = { id: string; title: string; sub?: string }

function RsvpFlow({ response, inv, initial, t, accent, onSent, onCancel, inSheet = false, onSwitch }: {
  response: RsvpResponse; inv: PublicInvite; initial: InviteRsvp | null; t: Theme; accent: string
  onSent: (r: InviteRsvp) => void; onCancel: () => void; inSheet?: boolean; onSwitch?: (r: RsvpResponse) => void
}) {
  const visitor = typeof window !== 'undefined' ? readVisitor() : null
  const [name, setName] = useState(initial?.name || visitor?.name || '')
  const [email, setEmail] = useState(initial?.email || visitor?.email || '')
  const [phone, setPhone] = useState(initial?.phone || visitor?.phone || '')
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(() => Object.fromEntries((initial?.answers || []).map(a => [a.questionId, a.value])))
  const days = inv.dates?.length ? inv.dates : allDays(inv)
  // Nothing picked to start with (owner, 10/31) - the guest taps the day(s) they're coming.
  const [picked, setPicked] = useState<string[]>(() => (initial?.days?.length ? initial.days : []))
  const [isAgent, setIsAgent] = useState<boolean | null>(initial?.is_agent ?? null)
  const [hasAgent, setHasAgent] = useState<boolean | null>(initial?.has_agent ?? null)
  const [interested, setInterested] = useState<boolean | null>(initial?.response === 'no' ? (initial.still_interested ?? null) : null)
  const [keep, setKeep] = useState<boolean | null>(initial?.keep_updated ?? null)
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const clients = inv.audience === 'clients'
  const isHome = !!inv.linked_property?.address
  const first = inv.agent.first_name || inv.agent.name.split(' ')[0] || 'your host'
  const questions = (inv.questions || []).filter(q => (response !== 'no' || q.role === 'brokerage') && !askedByRsvp(q, inv.audience))

  const steps: Step[] = []
  if (response === 'no') {
    if (clients && isHome) steps.push({ id: 'interested', title: 'Are you still interested in this home?', sub: `${first} can show it to you another time.` })
    if (interested === false || !(clients && isHome)) {
      steps.push({ id: 'nothanks', title: interested === false ? 'No worries!' : 'Sorry you can\'t make it', sub: `Leave your name so ${first} knows.` })
      questions.forEach(q => steps.push({ id: `q:${q.id}`, title: q.label }))
    } else if (interested) {
      steps.push({ id: 'name', title: "What's your name?" })
      steps.push({ id: 'contact', title: `How can ${first} reach you?`, sub: 'Email or phone - only they see it.' })
      steps.push({ id: 'isAgent', title: 'Are you a real estate agent?' })
      if (isAgent === false) steps.push({ id: 'hasAgent', title: 'Are you working with an agent?' })
      steps.push({ id: 'updates', title: 'Keep you updated on this home?', sub: 'Price changes, new open houses, under contract - nothing else.' })
    }
  } else {
    if (days.length > 1) steps.push({ id: 'days', title: 'Which day works for you?', sub: 'Pick one or more.' })
    steps.push({ id: 'name', title: "What's your name?" })
    steps.push({ id: 'contact', title: `How can ${first} reach you?`, sub: clients ? 'Email or phone - only they see it.' : 'So the host can send you the details.' })
    if (clients) {
      steps.push({ id: 'isAgent', title: 'Are you a real estate agent?' })
      if (isAgent === false) steps.push({ id: 'hasAgent', title: 'Are you working with an agent?' })
    }
    questions.forEach(q => steps.push({ id: `q:${q.id}`, title: q.label, sub: q.required ? undefined : 'Optional' }))
  }
  const k = Math.min(i, steps.length - 1)
  const step = steps[k]
  const last = k === steps.length - 1
  const qOf = (id: string) => questions.find(q => `q:${q.id}` === id)
  const valid = (s: Step): boolean => {
    if (s.id === 'days') return picked.length > 0
    if (s.id === 'name' || s.id === 'nothanks') return !!name.trim()
    if (s.id === 'contact') return /\S+@\S+\.\S+/.test(email.trim()) || phone.replace(/\D/g, '').length >= 7
    if (s.id === 'interested') return interested !== null
    if (s.id === 'isAgent') return isAgent !== null
    if (s.id === 'hasAgent') return hasAgent !== null
    if (s.id === 'updates') return keep !== null
    const q = qOf(s.id)
    if (q?.required) return Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).length > 0 : !!String(answers[q.id] || '').trim()
    return true
  }
  // Switching answer partway (owner, 10/31 - "I'll be there" -> "Maybe" and back): everything typed
  // so far stays, the guest stays on the same question when the new answer asks it too (else the
  // first one still to answer), and the questions slide over in the direction of the new choice.
  const [seen, setSeen] = useState(response)
  const shownId = useRef<string | null>(null)
  if (seen !== response) {
    const at = steps.findIndex(s => s.id === shownId.current)
    const open = steps.findIndex(s => !valid(s))
    setSeen(response)
    setI(at >= 0 ? at : open >= 0 ? open : 0)
    setDir(CHOICE_ORDER.indexOf(response) > CHOICE_ORDER.indexOf(seen) ? 1 : -1)
    setError('')
  }
  useEffect(() => { shownId.current = step.id })
  const goTo = (n: number) => { setDir(n > k ? 1 : -1); setError(''); setI(n) }
  const next = () => { if (!valid(step)) return; if (last) submit(); else goTo(k + 1) }
  // A one-tap answer moves on by itself (after a beat, so the tap shows).
  const tapThen = (fn: () => void) => { fn(); window.setTimeout(() => setI(n => n + 1), 220); setDir(1) }

  const submit = async () => {
    setError('')
    setBusy(true)
    // Only what THIS answer asked is sent - an answer given under the other choice (the days, "Are
    // you an agent?", "Still interested?") stays behind if the guest switched (owner, 10/31).
    const asked = (id: string) => steps.some(s => s.id === id)
    const r = await invitesApi.publicRsvp(inv.code, {
      response, name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined,
      answers: questions.filter(q => answers[q.id] !== undefined && asked(`q:${q.id}`)).map(q => ({ questionId: q.id, value: answers[q.id] })),
      token: initial?.token,
      days: asked('days') ? picked : undefined,
      is_agent: asked('isAgent') ? isAgent : undefined, has_agent: asked('hasAgent') ? hasAgent : undefined,
      still_interested: response === 'no' ? !!interested : undefined, keep_updated: asked('updates') ? !!keep : undefined,
    })
    setBusy(false)
    if (!r.success) { setError(r.error); return }
    saveVisitor({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined })
    onSent({ ...r.data, keep_updated: r.data.keep_updated ?? (response === 'no' && interested ? !!keep : null) })
  }

  const input = 'h-14 w-full rounded-2xl px-4 text-[16px] font-semibold outline-none transition focus:ring-2'
  const inputStyle = { background: t.dark ? 'rgba(255,255,255,.06)' : '#ffffff', border: `1px solid ${t.border}`, color: t.text, '--tw-ring-color': t.luxe ? t.m!.base : accent } as React.CSSProperties
  const big = (on: boolean): React.CSSProperties => on ? btnStyle(t, accent) : { background: t.dark ? 'rgba(255,255,255,.05)' : '#ffffff', border: `1px solid ${t.border}`, color: t.text }
  const yesNo = (value: boolean | null, set: (v: boolean) => void, labels: [string, string] = ['Yes', 'No']) => (
    <div className="grid grid-cols-2 gap-2.5">
      {[true, false].map((v, n) => (
        <motion.button key={String(v)} type="button" whileTap={{ scale: 0.96 }} onClick={() => tapThen(() => set(v))} data-testid={`rsvp-step-${v ? 'yes' : 'no'}`}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl text-[15px] font-black transition-colors" style={big(value === v)}>
          {value === v && <Check className="h-4 w-4" strokeWidth={3} />}{labels[n]}
        </motion.button>
      ))}
    </div>
  )

  const body = () => {
    switch (step.id) {
      case 'days':
        return (
          <div className="grid grid-cols-1 gap-2">
            {days.map(d => {
              const on = picked.includes(d.date)
              return (
                <motion.button key={d.date} type="button" whileTap={{ scale: 0.98 }} onClick={() => setPicked(p => on ? p.filter(x => x !== d.date) : [...p, d.date].sort())}
                  className="flex h-16 items-center gap-3 rounded-2xl px-4 text-left transition-colors" style={big(on)} data-testid={`rsvp-day-${d.date}`} aria-pressed={on}>
                  <CalendarDays className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block text-[15px] font-black">{dayLong(d.date)}</span><span className="block text-[12px] font-bold opacity-75">{clockRange(d.start, d.end)}</span></span>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ border: `1.5px solid currentColor` }}>{on && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}</span>
                </motion.button>
              )
            })}
          </div>
        )
      case 'interested':
        return yesNo(interested, v => setInterested(v), ['Yes, I am', 'No thanks'])
      case 'isAgent':
        return yesNo(isAgent, v => { setIsAgent(v); if (v) setHasAgent(null) })
      case 'hasAgent':
        return yesNo(hasAgent, v => setHasAgent(v))
      case 'updates':
        return (
          <div className="grid gap-2.5">
            {[true, false].map(v => (
              <motion.button key={String(v)} type="button" whileTap={{ scale: 0.97 }} onClick={() => setKeep(v)} data-testid={`rsvp-keep-${v ? 'yes' : 'no'}`}
                className="flex h-16 items-center gap-3 rounded-2xl px-4 text-left text-[15px] font-black transition-colors" style={big(keep === v)}>
                {v ? <BellRing className="h-5 w-5" /> : <X className="h-5 w-5" />}{v ? 'Yes - keep me updated on this property' : 'No, just this once'}
              </motion.button>
            ))}
          </div>
        )
      case 'name':
      case 'nothanks':
        return <input className={input} style={inputStyle} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="First and last name" data-testid="rsvp-name" onKeyDown={e => { if (e.key === 'Enter') next() }} />
      case 'contact':
        return (
          <div className="space-y-2.5">
            <input className={input} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" data-testid="rsvp-email" />
            <input className={input} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone (optional with an email)" data-testid="rsvp-phone" />
          </div>
        )
      default: {
        const q = qOf(step.id)
        if (!q) return null
        return <QuestionField q={q} value={answers[q.id]} t={t} accent={accent} input={input} inputStyle={inputStyle} big={big}
          onChange={(v, auto) => { setAnswers(a => ({ ...a, [q.id]: v })); if (auto && !last) window.setTimeout(() => { setDir(1); setI(n => n + 1) }, 220) }} />
      }
    }
  }
  const auto = ['interested', 'isAgent', 'hasAgent'].includes(step.id) || (qOf(step.id)?.type === 'select')

  return (
    <div data-testid="rsvp-flow">
      {inSheet && (
        <div className="mb-4 pr-12">
          <p className="flex text-[10px] font-black uppercase tracking-[0.26em]" style={foilText(t, accent)}>
            RSVP ·&nbsp;
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={response} className="inline-block" style={foilText(t, accent)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
                {response === 'yes' ? "I'll be there" : response === 'maybe' ? 'Maybe' : "Can't make it"}
              </motion.span>
            </AnimatePresence>
          </p>
          {onSwitch && (
            <div className="mt-2 flex gap-1.5">
              {CHOICES.map(c => {
                const on = c.id === response
                return (
                  <button key={c.id} type="button" onClick={() => onSwitch(c.id)} data-testid={`rsvp-switch-${c.id}`} aria-pressed={on}
                    className="relative h-8 rounded-full px-3 text-[11px] font-black transition-colors duration-200" style={{ background: soft(t), color: on ? (t.luxe ? '#17140f' : onAccent(accent)) : t.sub }}>
                    {/* the highlight slides from the old choice to the new one */}
                    {on && <motion.span layoutId="rsvp-switch-pill" aria-hidden className="absolute inset-0 rounded-full" style={{ ...btnStyle(t, accent), boxShadow: 'none' }} transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span className="relative">{c.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
      {/* progress */}
      <div className="mb-4 flex gap-1.5">
        {steps.map((s, n) => <span key={s.id} className="h-1 flex-1 rounded-full transition-all duration-500" style={{ background: n <= k ? (t.luxe ? t.m!.light : accent) : (t.dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)') }} />)}
      </div>
      <AutoHeight>
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div key={`${response}:${step.id}`} custom={dir} variants={STEP_SLIDE} initial="enter" animate="center" exit="exit"
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}>
            <h3 className="text-[24px] font-black leading-tight" style={{ fontFamily: SERIF, fontStyle: t.luxe ? 'italic' : 'normal' }}>{step.title}</h3>
            {step.sub && <p className="mt-1 text-[13px]" style={{ color: t.sub }}>{step.sub}</p>}
            <div className="mt-4">{body()}</div>
          </motion.div>
        </AnimatePresence>
      </AutoHeight>
      {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500">{error}</p>}
      <div className="mt-5 flex items-center gap-2">
        <button type="button" onClick={() => (k === 0 ? onCancel() : goTo(k - 1))} className="inline-flex h-14 items-center gap-1 rounded-2xl px-3 text-[12px] font-black uppercase tracking-widest" style={{ color: t.sub }}>
          <ArrowLeft className="h-4 w-4" /> {k === 0 ? 'Cancel' : 'Back'}
        </button>
        {(!auto || last) && (
          <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={next} disabled={busy || !valid(step)} data-testid={last ? 'rsvp-send' : 'rsvp-next'}
            className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[13px] font-black uppercase tracking-widest transition-opacity disabled:opacity-40 ${t.luxe ? 'ip-foil-anim' : ''}`} style={btnStyle(t, accent)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : last ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
            {last ? (initial ? 'Update my RSVP' : 'Send my RSVP') : 'Next'}
          </motion.button>
        )}
      </div>
    </div>
  )
}

function QuestionField({ q, value, onChange, t, accent, input, inputStyle, big }: {
  q: InviteQuestion; value: string | string[] | undefined; onChange: (v: string | string[], auto?: boolean) => void; t: Theme; accent: string
  input: string; inputStyle: React.CSSProperties; big: (on: boolean) => React.CSSProperties
}) {
  if (q.type === 'select' || q.type === 'multi_select') {
    const multi = q.type === 'multi_select'
    const picked = multi ? (Array.isArray(value) ? value : []) : value
    const many = (q.options || []).length > 4
    return (
      <div className={many ? 'flex flex-wrap gap-2' : 'grid gap-2'}>
        {(q.options || []).map(o => {
          const on = multi ? (picked as string[]).includes(o) : picked === o
          return (
            <motion.button key={o} type="button" whileTap={{ scale: 0.96 }}
              onClick={() => multi ? onChange(on ? (picked as string[]).filter(x => x !== o) : [...(picked as string[]), o]) : onChange(o, true)}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 text-[15px] font-black transition-colors ${many ? 'min-h-[48px]' : 'h-14'}`} style={big(on)}>
              {on && <Check className="h-4 w-4" strokeWidth={3} />}{o}
            </motion.button>
          )
        })}
      </div>
    )
  }
  if (q.type === 'long_text') {
    return <textarea className={`${input} h-28 resize-none py-3`} style={inputStyle} value={(value as string) || ''} placeholder={q.placeholder} onChange={e => onChange(e.target.value)} />
  }
  const type = q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : q.type === 'number' ? 'number' : q.type === 'date' ? 'date' : 'text'
  return <input className={input} style={inputStyle} type={type} value={(value as string) || ''} placeholder={q.placeholder} onChange={e => onChange(e.target.value)} />
}

// ------------------------------------------------------------------ the one-tap requests

const PARTS = [{ id: 'Morning', icon: Sunrise }, { id: 'Afternoon', icon: Sun }, { id: 'Evening', icon: Moon }] as const

function RequestFlow({ kind, inv, mine, t, accent, done, onSend, onClose }: {
  kind: InviteRequestKind; inv: PublicInvite; mine: InviteRsvp | null; t: Theme; accent: string; done: boolean
  onSend: (k: InviteRequestKind, extra?: { name?: string; email?: string; phone?: string; times?: string }) => Promise<{ ok: boolean; error: string }>; onClose: () => void
}) {
  const visitor = typeof window !== 'undefined' ? readVisitor() : null
  const [name, setName] = useState(mine?.name || visitor?.name || '')
  const [email, setEmail] = useState(mine?.email || visitor?.email || '')
  const [phone, setPhone] = useState(mine?.phone || visitor?.phone || '')
  const [day, setDay] = useState<string | null>(null)
  const [part, setPart] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(done)
  const first = inv.agent.first_name || inv.agent.name.split(' ')[0] || 'the host'
  const known = !!mine?.token && (kind === 'second_tour' ? !!(mine.email || mine.phone) : !!mine.email)
  const upcoming = useMemo(() => Array.from({ length: 8 }, (_, n) => { const d = new Date(); d.setDate(d.getDate() + n + 1); return d }), [])
  const needEmail = kind !== 'second_tour'
  const okContact = known || (!!name.trim() && (needEmail ? /\S+@\S+\.\S+/.test(email) : (/\S+@\S+\.\S+/.test(email) || phone.replace(/\D/g, '').length >= 7)))
  const okTime = kind !== 'second_tour' || (!!day && !!part)
  const title = kind === 'disclosure' ? 'Get the seller disclosure' : kind === 'second_tour' ? 'Book a second tour' : 'Stay updated on this home'
  const sub = kind === 'disclosure' ? `${first} will email it to you.` : kind === 'second_tour' ? `Pick a day and time - ${first} will confirm.` : 'An email when the price changes, an open house is set, or it goes under contract.'
  const send = async () => {
    setBusy(true); setError('')
    const times = kind === 'second_tour' && day ? `${new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - ${part}` : undefined
    const r = await onSend(kind, known ? { times } : { name: name.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, times })
    setBusy(false)
    if (!r.ok) { setError(r.error || "That didn't go through - try again in a moment."); return }
    setSent(true)
    window.setTimeout(onClose, 1800)
  }
  const input = 'h-14 w-full rounded-2xl px-4 text-[16px] font-semibold outline-none'
  const inputStyle = { background: t.dark ? 'rgba(255,255,255,.06)' : '#ffffff', border: `1px solid ${t.border}`, color: t.text } as React.CSSProperties
  const chip = (on: boolean): React.CSSProperties => on ? btnStyle(t, accent) : { background: t.dark ? 'rgba(255,255,255,.05)' : '#ffffff', border: `1px solid ${t.border}`, color: t.text }
  if (sent) {
    return (
      <div className="flex flex-col items-center py-8 text-center" data-testid="invite-request-done">
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 16 }} className="grid h-16 w-16 place-items-center rounded-full" style={btnStyle(t, accent)}><Check className="h-8 w-8" strokeWidth={3} /></motion.span>
        <p className="mt-4 text-2xl font-black" style={{ fontFamily: SERIF }}>{kind === 'updates' ? "You're on the list" : 'Request sent'}</p>
        <p className="mt-1 text-sm" style={{ color: t.sub }}>{kind === 'updates' ? "You'll hear about anything that changes." : `${first} has it and will be in touch.`}</p>
      </div>
    )
  }
  return (
    <div data-testid="invite-request">
      <p className="pr-12 text-[10px] font-black uppercase tracking-[0.26em]" style={foilText(t, accent)}>{kind === 'updates' ? 'Stay updated' : 'One tap'}</p>
      <h3 className="mt-1 pr-12 text-[24px] font-black leading-tight" style={{ fontFamily: SERIF }}>{title}</h3>
      <p className="mt-1 text-[13px]" style={{ color: t.sub }}>{sub}</p>
      {kind === 'second_tour' && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: t.sub }}>Which day?</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {upcoming.map(d => {
              const iso = d.toISOString().slice(0, 10)
              const on = day === iso
              return (
                <button key={iso} type="button" onClick={() => setDay(iso)} className="flex w-16 shrink-0 flex-col items-center rounded-2xl py-2.5" style={chip(on)}>
                  <span className="text-[10px] font-black uppercase opacity-70">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                  <span className="text-xl font-black leading-tight">{d.getDate()}</span>
                  <span className="text-[10px] font-bold uppercase opacity-60">{d.toLocaleDateString('en-US', { month: 'short' })}</span>
                </button>
              )
            })}
          </div>
          <p className="mb-2 mt-3 text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: t.sub }}>What time of day?</p>
          <div className="grid grid-cols-3 gap-2">
            {PARTS.map(p => (
              <button key={p.id} type="button" onClick={() => setPart(p.id)} className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[12px] font-black" style={chip(part === p.id)}>
                <p.icon className="h-4 w-4" />{p.id}
              </button>
            ))}
          </div>
        </div>
      )}
      {!known && (
        <div className="mt-4 space-y-2.5">
          <input className={input} style={inputStyle} value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Your name" data-testid="request-name" />
          <input className={input} style={inputStyle} value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder={needEmail ? 'Email' : 'Email (or a phone below)'} data-testid="request-email" />
          {kind === 'second_tour' && <input className={input} style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone" />}
        </div>
      )}
      {known && <p className="mt-4 rounded-2xl px-4 py-3 text-[13px] font-semibold" style={{ background: soft(t), color: t.sub }}>Sending as <b style={{ color: t.text }}>{mine!.name}</b>{mine!.email ? ` · ${mine!.email}` : ''}</p>}
      {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-500">{error}</p>}
      <motion.button type="button" whileTap={{ scale: 0.97 }} onClick={send} disabled={busy || !okContact || !okTime} data-testid="request-send"
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[13px] font-black uppercase tracking-widest transition-opacity disabled:opacity-40" style={btnStyle(t, accent)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : kind === 'updates' ? <BellRing className="h-4 w-4" /> : <Check className="h-4 w-4" strokeWidth={3} />}
        {kind === 'disclosure' ? 'Request the disclosure' : kind === 'second_tour' ? 'Request a second tour' : 'Keep me updated'}
      </motion.button>
      <p className="mt-2 text-center text-[11px]" style={{ color: t.sub }}>{kind === 'updates' ? 'Unsubscribe any time.' : `Goes straight to ${inv.agent.name}.`}</p>
    </div>
  )
}

/** The Cheat Sheet (the Guest Pass's own page), over the invitation. */
function CheatOverlay({ inv, accent, requested, onClose, onRequest }: {
  inv: PublicInvite; accent: string; requested: Record<string, boolean>; onClose: () => void; onRequest: (k: 'disclosure' | 'second_visit') => void
}) {
  const release = usePagePin(true)
  useEffect(() => () => release(), [release])
  const lp = inv.linked_property || {}
  const data: any = {
    guest: { first_name: '', full_name: '', email: '', phone: '', has_agent: false },
    home: { id: inv.id, listing_key: lp.listing_key, address: lp.address || inv.address, city: lp.city, state: lp.state, zipcode: lp.zipcode, price: lp.price,
      beds: lp.beds, baths: lp.baths, sqft: lp.sqft, photos: [lp.image, ...(lp.photos || [])].filter(Boolean) },
    agent: { id: inv.agent.id || '', name: inv.agent.name, first_name: inv.agent.first_name || inv.agent.name.split(' ')[0], title: inv.agent.title, brokerage: inv.agent.brokerage,
      photo_url: inv.agent.photo_url, phone: inv.agent.phone, text_phone: inv.agent.text_phone, email: inv.agent.email },
    theme: { accentColor: accent, darkMode: false }, similar: [], cheat_sheet: inv.cheat_sheet, spotlight_url: null, showcase: null,
    requested: { disclosure: !!requested.disclosure, second_visit: !!requested.second_tour },
  }
  return createPortal(
    <motion.div data-scroll-lock="off" className="fixed inset-0 z-[95] overflow-y-auto bg-[#FAFAF7]" style={{ ['--gp' as any]: accent }}
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} data-testid="invite-cheat">
      <div className="min-h-screen text-[#0B0B0B]">
        <CheatSheetView data={data} onRequest={onRequest} sending={null} onBack={onClose} />
      </div>
    </motion.div>,
    document.body,
  )
}

// ------------------------------------------------------------------ the "you're on the list" moment

function SentMoment({ rsvp, inv, days, accent, t, onChange, onDone }: { rsvp: InviteRsvp; inv: PublicInvite; days: InviteDay[]; accent: string; t: Theme; onChange: () => void; onDone: () => void }) {
  const first = inv.agent.first_name || inv.agent.name.split(' ')[0] || 'Your host'
  const declined = rsvp.response === 'no'
  const title = rsvp.response === 'yes' ? "You're on the list!" : rsvp.response === 'maybe' ? 'Got it - you\'re a maybe' : rsvp.still_interested ? 'Thanks - we\'ll be in touch' : 'No worries!'
  const text = declined
    ? (rsvp.still_interested ? `${first} will reach out about seeing the home another time.${rsvp.keep_updated ? " You'll also hear about price changes and new open houses." : ''}` : `Thanks for letting ${first} know.`)
    : `${first} has your RSVP${rsvp.guest_count > 1 ? ` - party of ${rsvp.guest_count}` : ''}.${rsvp.email ? ' A confirmation is on its way to your inbox.' : ''}`
  const ink = t.luxe ? t.m!.light : accent
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="flex flex-col items-center py-4 text-center" data-testid="invite-sent">
      <div className="relative">
        <motion.span className="absolute inset-0 rounded-full" style={{ background: ink, opacity: 0.3 }} initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 2.3, opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.05 }}
          className="relative grid h-20 w-20 place-items-center rounded-full" style={declined && !rsvp.still_interested ? { background: '#9ca3af' } : btnStyle(t, accent)}>
          <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke={declined && !rsvp.still_interested ? '#ffffff' : t.luxe ? '#17140f' : onAccent(accent)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }} />
          </svg>
        </motion.div>
        {!declined && Array.from({ length: 18 }).map((_, i) => {
          const a = (i / 18) * Math.PI * 2
          return <motion.span key={i} className="absolute left-1/2 top-1/2 rounded-sm" style={{ width: i % 2 ? 6 : 8, height: i % 2 ? 6 : 4, background: i % 3 === 0 ? ink : i % 3 === 1 ? mix(ink, '#ffffff', 0.5) : (t.dark ? '#ffffff' : '#111827') }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }} animate={{ x: Math.cos(a) * 92, y: Math.sin(a) * 92 + 20, opacity: 0, rotate: 180 }} transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }} />
        })}
      </div>
      <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6 text-3xl font-black" style={{ fontFamily: SERIF }}>{title}</motion.h3>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-2 max-w-sm text-sm" style={{ color: t.sub }}>{text}</motion.p>
      {!declined && <div className="w-full text-left"><CalendarButtons inv={inv} t={t} days={days} /></div>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onChange} className="h-11 rounded-full px-4 text-[11px] font-black uppercase tracking-widest" style={{ border: `1.5px solid ${ink}`, color: t.text }}>Change my RSVP</button>
        <button type="button" onClick={onDone} className="h-11 rounded-full px-4 text-[11px] font-black uppercase tracking-widest" style={{ color: t.sub }}>Done</button>
      </div>
    </motion.div>
  )
}

// Owner, 10/31 (lag): nothing on the guest page moves forever any more. The Luxe room's light is
// still (three soft glows and a little foil dust, no drifting full-screen layers), the panels' gold
// edges are still lines, and the card's light sweep, the foil buttons and the bell play a couple of
// times after the page opens and rest. No blur anywhere.
const PAGE_CSS = `
.ip-aur{position:absolute;inset:0}
.ip-aur1{background:radial-gradient(34% 30% at 26% 26%, rgba(var(--mr),.30), transparent 70%)}
.ip-aur2{background:radial-gradient(30% 28% at 76% 66%, rgba(var(--ml),.20), transparent 70%)}
.ip-aur3{background:radial-gradient(44% 32% at 50% 104%, rgba(var(--mr),.32), transparent 70%)}
.ip-dust{position:absolute;border-radius:9999px;background:var(--mp);opacity:.45}
.ip-cardsweep{position:absolute;top:-20%;bottom:-20%;width:30%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.32),transparent);transform:translateX(-200%) skewX(-16deg);animation:ipSweep 6.5s cubic-bezier(.6,.05,.3,1) 1.5s 2}
@keyframes ipSweep{0%{transform:translateX(-200%) skewX(-16deg)}35%,100%{transform:translateX(480%) skewX(-16deg)}}
.ip-lux-panel{box-shadow:0 24px 44px -34px rgba(0,0,0,.9)}
.ip-lux-strong{box-shadow:0 24px 50px -32px rgba(0,0,0,.95)}
.ip-lux-edge{background:linear-gradient(90deg,transparent 0%,rgba(255,243,207,0) 20%,rgba(255,243,207,.6) 50%,rgba(255,243,207,0) 80%,transparent 100%)}
.ip-foil-anim{animation:ipFoil 3.4s ease-in-out 2}
@keyframes ipFoil{0%{background-position:100% 0}100%{background-position:-120% 0}}
.ip-bell{animation:ipBell 3.2s ease-in-out 3;transform-origin:50% 0}
@keyframes ipBell{0%,70%,100%{transform:rotate(0)}76%{transform:rotate(12deg)}82%{transform:rotate(-10deg)}88%{transform:rotate(6deg)}94%{transform:rotate(-3deg)}}
@media (prefers-reduced-motion:reduce){.ip-cardsweep,.ip-foil-anim,.ip-bell{animation:none}}
`
