'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Star, Check, Loader2, ExternalLink, Copy, Send, ChevronLeft, Home, KeyRound } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import api from '@/lib/api-service'
import { LuxeSurface } from '@/components/ui/LuxeSurface'
import { OhpWordmark } from '@/components/brand/OhpBrand'
import { copyText } from '@/lib/copyText'

type Dests = { google_place_id: string | null; google_review_url: string | null; zillow_review_url: string | null }

const LS = (id: string, where: string) => `ohp-review-${id}-${where}`
const RATING_WORD = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

export default function LeaveReviewPage() {
  const params = useParams<{ slug: string }>()
  const slug = params?.slug || ''

  const [agent, setAgent] = useState<{
    name: string; first: string; photo: string | null; title: string | null; brokerage: string | null
  }>({ name: '', first: '', photo: null, title: null, brokerage: null })
  const [summary, setSummary] = useState<{ count: number; average: number | null }>({ count: 0, average: null })
  const [dests, setDests] = useState<Dests>({ google_place_id: null, google_review_url: null, zillow_review_url: null })
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const [submitted, setSubmitted] = useState<{ id: string; rating: number; dests: Dests; isPublic: boolean } | null>(null)
  const [posted, setPosted] = useState<{ google: boolean; zillow: boolean }>({ google: false, zillow: false })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!slug) return
    api.reviews.get(slug).then(r => {
      if (r.success && r.data) {
        setAgent({
          name: r.data.agent_name,
          first: r.data.agent_first_name || (r.data.agent_name || '').split(' ')[0],
          photo: r.data.agent_photo_url,
          title: r.data.agent_title,
          brokerage: r.data.agent_brokerage,
        })
        setSummary(r.data.summary)
        setDests(r.data.destinations || { google_place_id: null, google_review_url: null, zillow_review_url: null })
      } else {
        setNotFound(true)
      }
      setLoading(false)
    })
  }, [slug])

  useEffect(() => {
    if (!submitted) return
    try {
      setPosted({
        google: localStorage.getItem(LS(submitted.id, 'google')) === '1',
        zillow: localStorage.getItem(LS(submitted.id, 'zillow')) === '1',
      })
    } catch { /* ignore */ }
  }, [submitted])

  const hasGoogle = !!dests.google_review_url
  const hasZillow = !!dests.zillow_review_url
  const hasPublicDest = hasGoogle || hasZillow
  const positive = rating >= 4

  const copyBody = () => {
    if (!body.trim()) return
    copyText(body.trim()).then(() => setCopied(true)).catch(() => {})
  }

  // Save the review to OpenHousePal. `silent` = no inline validation errors (used when the save
  // is a side-effect of tapping Google/Zillow). Returns the review id or null.
  const submit = async ({ silent = false } = {}): Promise<string | null> => {
    if (submitted?.id) return submitted.id
    if (!rating || !name.trim() || !body.trim()) {
      if (!silent) setErr(!rating ? 'Pick a star rating first.' : 'Add your name and a few words.')
      return null
    }
    setErr('')
    setSubmitting(true)
    const res = await api.reviews.submit(slug, { reviewer_name: name.trim(), reviewer_email: email.trim() || undefined, rating, body: body.trim() })
    setSubmitting(false)
    if (res.success && res.data) {
      copyBody()
      setSubmitted({ id: res.data.id, rating: res.data.rating, dests: res.data.destinations, isPublic: res.data.is_public })
      return res.data.id
    }
    if (!silent) setErr(res.error || 'Could not submit. Please try again.')
    return null
  }

  // One tap: open the real Google / Zillow review page in a new tab (keeps the visitor's
  // logged-in session), copy their text for the paste, save the review to OpenHousePal, and mark
  // it as posted there — no confirmation step.
  const openPublic = async (where: 'google' | 'zillow', url: string) => {
    window.open(url, '_blank', 'noopener')     // synchronous — inside the click gesture
    copyBody()
    setPosted(p => ({ ...p, [where]: true }))
    const id = submitted?.id ?? await submit({ silent: true })
    if (id) {
      try { localStorage.setItem(LS(id, where), '1') } catch { /* ignore */ }
      api.reviews.markPosted(slug, id, where)
    }
  }

  const onwardDests = submitted?.dests || dests
  const showOnward = useMemo(() => {
    if (!submitted || !submitted.isPublic) return false
    return !!(onwardDests.google_review_url || onwardDests.zillow_review_url)
  }, [submitted, onwardDests])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] dark:bg-[#0B0B0B]"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  }
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-4 dark:bg-[#0B0B0B]">
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">This review link isn’t active.</p>
      </div>
    )
  }

  const initials = (agent.name || 'A').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
  // Rate -> Write -> Done, for the progress dots.
  const step = submitted ? 2 : rating > 0 ? 1 : 0
  const shown = hover || rating

  function onwardOrDest(where: 'google' | 'zillow'): string | null {
    const d = submitted?.dests || dests
    return where === 'google' ? d.google_review_url : d.zillow_review_url
  }

  const pasteBlock = (
    <div className="mt-4">
      <motion.button whileTap={{ scale: 0.97 }} onClick={copyBody}
        className="relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[#111827] px-4 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_14px_30px_-14px_rgba(17,24,39,.8)] transition hover:-translate-y-0.5 dark:bg-white dark:text-[#111827]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span key={copied ? 'y' : 'n'} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} className="relative inline-flex items-center gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Review copied' : 'Copy my review'}
          </motion.span>
        </AnimatePresence>
      </motion.button>
      <p className="mt-2 text-center text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        Your review copies automatically when you tap below — just <span className="font-black text-[#111827] dark:text-white">paste</span> it in
        {' '}(long-press → Paste on a phone).
      </p>
      <div className="mt-3 space-y-2">
        {onwardOrDest('google') && (
          <PostButton label="Post on Google" primary done={posted.google} delay={0.05} onClick={() => openPublic('google', onwardOrDest('google')!)} />
        )}
        {onwardOrDest('zillow') && (
          <PostButton label="Post on Zillow" done={posted.zillow} delay={0.12} onClick={() => openPublic('zillow', onwardOrDest('zillow')!)} />
        )}
      </div>
    </div>
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#faf9f7] dark:bg-[#0B0B0B]">
      <style>{REVIEW_CSS}</style>
      {/* Page-wide ambient gold light + slowly drifting real-estate outlines, like the luxe headers */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="rv-drift-a absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-[#C9A24D]/15 blur-3xl" />
        <div className="rv-drift-b absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-[#f3d9a0]/30 blur-3xl dark:bg-[#8b6a2b]/15" />
        <Home className="rv-float absolute left-[6%] top-[58%] hidden h-28 w-28 text-[#C9A24D]/[0.12] sm:block" strokeWidth={0.8} />
        <KeyRound className="rv-float-b absolute right-[7%] top-[46%] hidden h-24 w-24 text-[#C9A24D]/[0.12] sm:block" strokeWidth={0.8} />
      </div>

      {/* Hero - the luxe surface: agent, title, live rating summary */}
      <LuxeSurface icon={Star} className="px-4 pb-14 pt-7 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[#faf9f7] dark:to-[#0B0B0B]" />
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }} className="relative mx-auto max-w-lg">
          <div className="relative mx-auto w-fit">
            <span aria-hidden className="rv-ring absolute -inset-1.5 rounded-full" />
            <div className="relative rounded-full shadow-[0_12px_30px_-12px_rgba(139,115,85,.8)]"><AgentAvatar photo={agent.photo} name={agent.name} initials={initials} size={64} /></div>
          </div>
          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.32em] text-[#8b7355] dark:text-[#e8c97a]">Client review</p>
          <h1 className="lx-title mt-1 font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white sm:text-3xl">
            How was working with <em>{agent.first || agent.name || 'your agent'}?</em>
          </h1>
          <p className="mt-1 line-clamp-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#8b7355]/80 dark:text-white/50 sm:text-[11px]">
            {[agent.name, agent.title, agent.brokerage].filter(Boolean).join(' · ')}
          </p>
          {summary.count > 0 && summary.average != null && (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-[#C9A24D]/30 bg-white/70 px-3 py-1 text-[10px] font-bold text-[#6b5a45] dark:border-white/10 dark:bg-white/[0.06] dark:text-white/80">
              {[1, 2, 3, 4, 5].map(n => (
                <Star key={n} className={`h-3 w-3 ${summary.average! >= n - 0.25 ? 'fill-[#C9A24D] text-[#C9A24D]' : 'text-[#C9A24D]/30'}`} />
              ))}
              <span className="ml-1">{summary.average.toFixed(1)} · {summary.count} review{summary.count === 1 ? '' : 's'}</span>
            </div>
          )}
        </motion.div>
      </LuxeSurface>

      <div className="relative z-10 mx-auto -mt-8 max-w-lg px-4 pb-12">
        <motion.div layout initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5, delay: 0.1, ease: [0.2, 0.8, 0.2, 1], layout: { duration: 0.35 } }}
          className="relative overflow-hidden rounded-3xl border border-[#C9A24D]/30 bg-white/95 p-5 shadow-[0_30px_70px_-35px_rgba(139,115,85,.6)] dark:border-white/[0.08] dark:bg-[#121214]/95 sm:p-7">
          <div aria-hidden className="lx-edge pointer-events-none absolute inset-x-0 top-0 h-px" />

          {/* Progress - Rate · Write · Done */}
          <div className="mb-5 flex items-center justify-center gap-2">
            {['Rate', 'Write', 'Done'].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <motion.span animate={{ scale: step === i ? 1.15 : 1, backgroundColor: step >= i ? '#C9A24D' : 'rgba(156,163,175,0.35)' }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black text-white">
                    {step > i ? <Check className="h-3 w-3" strokeWidth={3.5} /> : i + 1}
                  </motion.span>
                  <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${step >= i ? 'text-[#8b7355] dark:text-[#e8c97a]' : 'text-gray-400 dark:text-white/30'}`}>{label}</span>
                </div>
                {i < 2 && (
                  <span className="relative h-px w-6 overflow-hidden bg-gray-200 dark:bg-white/10 sm:w-10">
                    <motion.span className="absolute inset-0 origin-left bg-[#C9A24D]" initial={false} animate={{ scaleX: step > i ? 1 : 0 }} transition={{ duration: 0.4 }} />
                  </span>
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {!submitted ? (
              <motion.div key="form" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.25 }}>
                {/* Step 1 — stars */}
                <p className="text-center text-xs font-bold text-gray-500 dark:text-white/55">{rating ? 'Your rating' : 'Tap a star to rate'}</p>
                <div className="mt-2 flex justify-center gap-1.5 sm:gap-2" onMouseLeave={() => setHover(0)}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <motion.button key={`${n}-${rating}`} type="button" onMouseEnter={() => setHover(n)} onClick={() => { setRating(n); setErr('') }} aria-label={`${n} star${n > 1 ? 's' : ''}`}
                      whileHover={{ scale: 1.18, rotate: -6 }} whileTap={{ scale: 0.85 }}
                      animate={rating >= n ? { scale: [1, 1.3, 1], transition: { delay: (n - 1) * 0.05, duration: 0.35 } } : { scale: 1 }}
                      className="relative">
                      {rating === 5 && n === 5 && <span aria-hidden className="rv-burst pointer-events-none absolute inset-0" />}
                      <Star className={`h-11 w-11 transition-colors duration-150 sm:h-12 sm:w-12 ${shown >= n ? 'fill-[#C9A24D] text-[#C9A24D] drop-shadow-[0_4px_10px_rgba(201,162,77,.45)]' : 'text-gray-300 dark:text-gray-600'}`} />
                    </motion.button>
                  ))}
                </div>
                <div className="mt-2 h-5 text-center">
                  <AnimatePresence mode="wait">
                    {shown > 0 && (
                      <motion.p key={shown} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }}
                        className="text-xs font-black uppercase tracking-[0.25em] text-[#8b7355] dark:text-[#d7b974]">
                        {RATING_WORD[shown]}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence initial={false}>
                  {rating > 0 && (
                    <motion.div key="details" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
                      <div className="pt-4">
                        {/* Who it's for + the stars they picked - the same strip for every rating */}
                        <motion.div key={rating} initial={{ scale: 0.97, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                          className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 ${rating === 5 ? 'border-[#C9A24D]/50 bg-gradient-to-r from-[#fbf3df] via-white to-[#fbf3df] dark:from-[#C9A24D]/15 dark:via-transparent dark:to-[#C9A24D]/10' : 'border-[#C9A24D]/25 bg-[#C9A24D]/[0.06]'}`}>
                          {rating === 5 && <span aria-hidden className="lx-shine pointer-events-none absolute inset-0" />}
                          <AgentAvatar photo={agent.photo} name={agent.name} initials={initials} size={40} />
                          <div className="relative min-w-0 flex-1">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map(n => (
                                <Star key={n} className={`h-3.5 w-3.5 ${rating >= n ? 'fill-[#C9A24D] text-[#C9A24D]' : 'text-[#C9A24D]/25'}`} />
                              ))}
                              {rating === 5 && <span className="ml-1.5 rounded-full bg-[#C9A24D] px-1.5 py-px text-[8px] font-black uppercase tracking-widest text-[#111827]">5-star</span>}
                            </div>
                            <p className="mt-0.5 truncate font-serif text-sm font-black text-[#111827] dark:text-white">{positive ? 'A review for ' : 'Feedback for '}{agent.name}</p>
                          </div>
                        </motion.div>

                        {positive ? (
                          <>
                            <ReviewFields
                              name={name} setName={setName} email={email} setEmail={setEmail} body={body} setBody={v => { setBody(v); setCopied(false) }}
                              first={agent.first} placeholderPrompt />
                            <ErrLine err={err} />
                            {hasPublicDest ? (
                              <>
                                {pasteBlock}
                                <button onClick={() => submit()} disabled={submitting}
                                  className="mx-auto mt-4 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 transition hover:translate-x-0.5 hover:text-[#8b7355] disabled:opacity-50">
                                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Just send it to {agent.first || 'them'} →
                                </button>
                              </>
                            ) : (
                              <SubmitButton submitting={submitting} onClick={() => submit()} label="Submit review" />
                            )}
                          </>
                        ) : (
                          <>
                            <ReviewFields
                              name={name} setName={setName} email={email} setEmail={setEmail} body={body} setBody={setBody}
                              first={agent.first} emailHint />
                            <ErrLine err={err} />
                            <SubmitButton submitting={submitting} onClick={() => submit()} label={`Send to ${agent.first || 'your agent'}`} />
                          </>
                        )}

                        <button onClick={() => { setRating(0); setHover(0); setErr('') }}
                          className="mx-auto mt-4 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400 transition hover:-translate-x-0.5 hover:text-[#8b7355]">
                          <ChevronLeft className="h-3.5 w-3.5" /> Change rating
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div key="done" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                {/* Success - gold check draws itself in, a little burst of gold around it */}
                <div className="relative flex flex-col items-center text-center">
                  {GOLD_BITS.map((b, k) => (
                    <motion.span key={k} aria-hidden className="pointer-events-none absolute left-1/2 top-7 h-1.5 w-1.5 rounded-full bg-[#C9A24D]"
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }} animate={{ x: b[0], y: b[1], opacity: 0, scale: 0.4 }} transition={{ duration: 1.1, delay: 0.15, ease: 'easeOut' }} />
                  ))}
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 16 }}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#e8c97a] via-[#C9A24D] to-[#8b6a2b] text-white shadow-[0_14px_30px_-12px_rgba(201,162,77,.9)]">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25 }} />
                    </svg>
                  </motion.div>
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lx-title mt-3 font-serif text-2xl font-black text-[#111827] dark:text-white">Thank <em>you!</em></motion.p>
                  <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {submitted.isPublic
                      ? `Your review went to ${agent.first || 'your agent'}.`
                      : `Sent to ${agent.first || 'your agent'} — they’ll follow up with you personally.`}
                  </motion.p>
                </div>

                {showOnward && (
                  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}
                    className="mt-5 rounded-2xl border border-[#C9A24D]/40 bg-[#C9A24D]/[0.07] p-4">
                    <p className="text-sm font-black text-[#111827] dark:text-white">One paste and you’re done</p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      Share the same words publicly — it means the world to {agent.first || 'them'}.
                    </p>
                    {pasteBlock}
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="mt-6 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#8b7355]/45 dark:text-white/25">
          Powered by <OhpWordmark className="text-[1.15em] align-[-0.15em]" />
        </p>
      </div>
    </div>
  )
}

const GOLD_BITS: [number, number][] = [[-70, -30], [-50, 40], [-20, -55], [25, -60], [60, -25], [72, 30], [40, 55], [-10, 62], [-78, 5], [82, -2]]

const REVIEW_CSS = `
.rv-ring{background:conic-gradient(from 0deg,#e8c97a,#8b6a2b,#f3d9a0,#C9A24D,#e8c97a);animation:rvSpin 6s linear infinite;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px))}
@keyframes rvSpin{to{transform:rotate(360deg)}}
.rv-burst{border-radius:9999px;animation:rvBurst 1.1s ease-out 1}
@keyframes rvBurst{from{box-shadow:0 0 0 0 rgba(201,162,77,.6)}to{box-shadow:0 0 0 22px rgba(201,162,77,0)}}
.rv-drift-a{animation:lxDriftA 18s ease-in-out infinite alternate}
.rv-drift-b{animation:lxDriftB 22s ease-in-out infinite alternate}
.rv-float{animation:rvFloat 9s ease-in-out infinite alternate}
.rv-float-b{animation:rvFloat 11s ease-in-out -3s infinite alternate-reverse}
@keyframes rvFloat{from{transform:translateY(0) rotate(-6deg)}to{transform:translateY(-16px) rotate(3deg)}}
@media (prefers-reduced-motion: reduce){.rv-ring,.rv-burst,.rv-drift-a,.rv-drift-b,.rv-float,.rv-float-b{animation:none}}
`

function ErrLine({ err }: { err: string }) {
  return (
    <AnimatePresence>
      {err && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -4, 4, -2, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} className="mt-2 text-xs font-bold text-red-600 dark:text-red-400">{err}</motion.p>}
    </AnimatePresence>
  )
}

function SubmitButton({ submitting, onClick, label }: { submitting: boolean; onClick: () => void; label: string }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onClick} disabled={submitting}
      className="lx-shine group relative mt-4 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] px-4 py-3.5 text-sm font-black uppercase tracking-wide text-[#111827] shadow-[0_14px_30px_-14px_rgba(201,162,77,.9)] transition hover:-translate-y-0.5 disabled:opacity-60">
      <span className="relative inline-flex items-center gap-2">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 transition-transform group-hover:-rotate-12 group-hover:translate-x-0.5" />} {label}
      </span>
    </motion.button>
  )
}

function AgentAvatar({ photo, name, initials, size }: { photo: string | null; name: string; initials: string; size: number }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-full border-2 border-[#C9A24D]/70 bg-[#111827]" style={{ height: size, width: size }}>
      {photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo} alt={name} className="h-full w-full object-cover" />
        : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#C9A24D] to-[#8b7355] font-black text-[#111827]" style={{ fontSize: size * 0.36 }}>{initials}</div>}
    </div>
  )
}

const FIELD = 'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#C9A24D] focus:shadow-[0_0_0_4px_rgba(201,162,77,.14)] dark:border-gray-700 dark:bg-[#0B0B0B] dark:text-white'

function ReviewFields({ name, setName, email, setEmail, body, setBody, first, placeholderPrompt, emailHint }: {
  name: string; setName: (v: string) => void
  email: string; setEmail: (v: string) => void
  body: string; setBody: (v: string) => void
  first: string; placeholderPrompt?: boolean; emailHint?: boolean
}) {
  return (
    <div className="mt-4 space-y-2.5">
      {[
        <input key="n" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className={`${FIELD} font-semibold`} />,
        <input key="e" value={email} onChange={e => setEmail(e.target.value)} placeholder={emailHint ? 'Email (so they can reach you)' : 'Email (optional)'} className={`${FIELD} font-semibold`} />,
        <textarea key="b" value={body} onChange={e => setBody(e.target.value)} rows={5}
          placeholder={placeholderPrompt ? `What stood out about working with ${first || 'them'}? Write it once — you'll copy & paste it.` : `Tell ${first || 'them'} what didn’t go well.`}
          className={FIELD} />,
      ].map((el, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.06 }}>{el}</motion.div>
      ))}
    </div>
  )
}

function PostButton({ label, done, primary, onClick, delay = 0 }: { label: string; done: boolean; primary?: boolean; onClick: () => void; delay?: number }) {
  const base = 'relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-3 text-sm font-black uppercase tracking-wide transition hover:-translate-y-0.5'
  const skin = done
    ? 'border-2 border-green-400 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
    : primary
      ? 'lx-shine bg-gradient-to-r from-[#C9A24D] to-[#e8c97a] text-[#111827] shadow-lg shadow-[#C9A24D]/25 hover:shadow-xl'
      : 'border-2 border-[#C9A24D]/50 bg-white text-[#8b7355] hover:border-[#C9A24D] dark:bg-transparent dark:text-[#d7b974]'
  return (
    <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} whileTap={{ scale: 0.97 }} onClick={onClick} className={`${base} ${skin}`}>
      <span className="relative inline-flex items-center gap-2">
        {done ? <Check className="h-4 w-4" /> : <Star className="h-4 w-4 fill-current" />}
        {done ? `${label.replace('Post on', 'Posted on')} ✓` : label}
        {!done && <ExternalLink className="h-3.5 w-3.5" />}
      </span>
    </motion.button>
  )
}
