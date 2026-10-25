'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Mail, MessageSquare, Send, X } from 'lucide-react'
import AutoHeight from '@/components/ui/AutoHeight'
import { backdropMotion, useEscapeToClose, useIsPhone, usePagePin, useSheetMotion, useSwipeToClose } from '@/components/ui/windowMotion'
import { readVisitor, saveVisitor } from '@/lib/visitor'
import { visitSource } from '@/lib/visitSource'
import { fmtNumber, type PropertySiteAgent, type SpotlightModel } from './model'

// The Spotlight's "Request info" and "Get the documents" windows (user, 10/24), built exactly like
// the Schedule a Showing window guests love: the home on a lit photo panel, then one short step at
// a time - a bottom sheet on a phone (pull down to close), a two-panel window on a computer. The
// window's height glides as steps change (AutoHeight), never jumps. Whatever the visitor types is
// remembered (lib/visitor) so every other form on the page fills itself in.

export interface FlowHome {
  siteId: string
  street: string
  place?: string
  photo?: string | null
  facts?: string
  agent?: PropertySiteAgent
}

/** The home as the windows show it, from a template's model. */
export function flowHomeOf(m: SpotlightModel, siteId: string): FlowHome {
  const p = m.p
  return {
    siteId, street: p.address.split(',')[0], photo: m.heroImage, agent: m.agent,
    place: [p.city, [p.state, p.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    facts: [p.beds != null ? `${fmtNumber(p.beds)} bd` : '', p.baths != null ? `${fmtNumber(p.baths)} ba` : '', p.sqft ? `${fmtNumber(p.sqft)} sqft` : ''].filter(Boolean).join(' · '),
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').replace(/^1(?=\d{10})/, '').slice(0, 10)
  if (d.length < 4) return d
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

/** Name / email / phone, prefilled from what this visitor already told the site. */
export function useGuestContact() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  useEffect(() => {
    const v = readVisitor()
    if (!v) return
    setName(n => n || v.name || '')
    setEmail(e => e || v.email || '')
    setPhone(p => p || (v.phone ? formatPhone(v.phone) : ''))
  }, [])
  const remember = () => saveVisitor({ name: name.trim(), email: email.trim(), phone: phone.trim() })
  const split = () => {
    const [first, ...rest] = name.trim().split(/\s+/)
    return { first_name: first || '', last_name: rest.join(' ') || '-' }
  }
  return { name, setName, email, setEmail, phone, setPhone, remember, split }
}

// ------------------------------------------------------------------ the window

function FlowShell({ home, kicker, icon, steps, stepNo, done, onClose, busy, children, footer }: {
  home: FlowHome
  kicker: string
  icon: ReactNode
  steps: string[]
  stepNo: number
  done: boolean
  onClose: () => void
  busy: boolean
  children: ReactNode
  footer?: ReactNode
}) {
  const sheetMotion = useSheetMotion()
  const isPhone = useIsPhone()
  const { sheetRef, y } = useSwipeToClose(onClose, isPhone && !busy)
  useEscapeToClose(onClose, !busy)
  const street = home.street
  return (
    <motion.div {...backdropMotion} data-scroll-lock="off"
      className="fixed inset-0 z-[160] flex items-end justify-center bg-[#0b0b0c]/70 sm:items-center sm:p-5"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <style>{FLOW_CSS}</style>
      <motion.div ref={sheetRef} {...sheetMotion} style={isPhone ? { y } : undefined} role="dialog" aria-modal="true" aria-label={kicker}
        className="relative grid max-h-[100dvh] w-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-t-[26px] bg-white shadow-[0_40px_100px_-30px_rgba(0,0,0,.7)] dark:bg-[#111113] sm:max-h-[min(640px,calc(100dvh-2.5rem))] sm:max-w-[860px] sm:grid-cols-[290px_minmax(0,1fr)] sm:grid-rows-1 sm:rounded-[30px]">
        {/* ---- the home, lit */}
        <div className="relative isolate overflow-hidden bg-[#0b0b0c] text-white">
          {home.photo && <img src={home.photo} alt="" className="gf-ken absolute inset-0 -z-20 h-full w-full object-cover" />}
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_100%_0%,rgba(201,162,77,.45),transparent_55%),linear-gradient(180deg,rgba(11,11,12,.35),rgba(11,11,12,.92))]" />
          <span aria-hidden className="gf-edge pointer-events-none absolute inset-x-0 top-0 h-px" />
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-2 z-10 h-1.5 w-10 -translate-x-1/2 rounded-full bg-white/35 sm:hidden" />
          {[['14%', '22%', 0], ['80%', '16%', 1.4], ['70%', '64%', 2.6], ['30%', '80%', 1.9]].map(([l, t, d], k) => (
            <span key={k} aria-hidden className="gf-spark pointer-events-none absolute" style={{ left: l as string, top: t as string, animationDelay: `${d}s` }} />
          ))}
          <div className="flex h-full flex-col p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#e8c97a]">{icon} {kicker}</p>
              <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:hidden"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-3 sm:mt-auto">
              <h2 className="truncate whitespace-nowrap font-serif font-black leading-tight" title={street}
                style={{ fontSize: street.length > 24 ? '1.05rem' : street.length > 18 ? '1.25rem' : street.length > 13 ? '1.5rem' : '1.75rem' }}>{street}</h2>
              {home.place && <p className="mt-0.5 text-[13px] font-semibold text-white/70">{home.place}</p>}
              {home.facts && <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#e8c97a]">{home.facts}</p>}
            </div>
            {steps.length > 1 && (
              <>
                <div className="mt-4 flex gap-1.5 sm:hidden">
                  {steps.map((_, i) => <span key={i} className={`h-1 rounded-full transition-all duration-500 ${i + 1 <= stepNo ? 'w-8 bg-[#e8c97a]' : 'w-4 bg-white/25'}`} />)}
                </div>
                <ol className="mt-8 hidden space-y-3 sm:block">
                  {steps.map((label, i) => {
                    const n = i + 1
                    const ok = n < stepNo || done
                    return (
                      <li key={label} className={`flex items-center gap-3 text-sm font-bold transition-colors duration-300 ${n === stepNo ? 'text-white' : ok ? 'text-white/70' : 'text-white/35'}`}>
                        <span className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-black transition-all duration-300 ${ok ? 'bg-[#e8c97a] text-[#111827]' : n === stepNo ? 'bg-white text-[#111827] shadow-[0_0_0_4px_rgba(232,201,122,.25)]' : 'bg-white/10'}`}>
                          {ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
                        </span>
                        {label}
                      </li>
                    )
                  })}
                </ol>
              </>
            )}
          </div>
        </div>

        {/* ---- the steps */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="scrollbar-hide relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none]">
            <AutoHeight>{children}</AutoHeight>
          </div>
          {footer && !done && (
            <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-4 dark:border-white/[0.07] sm:px-8" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              {footer}
            </div>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-4 top-4 hidden h-9 w-9 place-items-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-[#111827] dark:hover:bg-white/10 dark:hover:text-white sm:grid"><X className="h-5 w-5" /></button>
      </motion.div>
    </motion.div>
  )
}

const slide = {
  initial: (d: number) => ({ opacity: 0, x: d * 36 }),
  animate: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 34 } },
  exit: (d: number) => ({ opacity: 0, x: d * -28, transition: { duration: 0.16 } }),
} as const

function StepHead({ no, of, title }: { no: number; of: number; title: string }) {
  return (
    <div className="pb-1 pt-5 sm:pr-10 sm:pt-7">
      {of > 1 && <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[#a8843a] dark:text-[#e8c97a]">Step {no} of {of}</p>}
      <h3 className="font-serif text-2xl font-black leading-tight text-[#111827] dark:text-white">{title}</h3>
    </div>
  )
}

export function FlowField({ label, value, onChange, placeholder, type = 'text', autoComplete, inputMode, invalid }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; invalid?: boolean
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode}
        aria-invalid={invalid || undefined}
        className={`block w-full rounded-2xl border bg-[#FAFAF7] px-4 py-3 text-[16px] font-semibold text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:bg-[#0b0b0c] dark:text-white sm:text-sm ${invalid ? 'border-rose-400' : 'border-gray-200 dark:border-white/10'}`} />
    </label>
  )
}

function DoneMoment({ title, body, onClose, icon = 'check' }: { title: string; body: ReactNode; onClose: () => void; icon?: 'check' | 'mail' }) {
  return (
    <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="flex flex-col items-center justify-center px-6 py-12 text-center sm:py-16">
      <div className="relative">
        <motion.span className="absolute inset-0 rounded-full bg-emerald-400/30" initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.05 }}
          className="relative grid h-20 w-20 place-items-center rounded-full bg-emerald-500 shadow-[0_18px_40px_-12px_rgba(16,185,129,.8)]">
          {icon === 'mail' ? (
            <motion.span initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 18 }}><Mail className="h-9 w-9 text-white" /></motion.span>
          ) : (
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.25, ease: 'easeOut' }} />
            </svg>
          )}
        </motion.div>
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2
          return <motion.span key={i} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full" style={{ background: i % 2 ? '#C9A24D' : '#34d399' }}
            initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(a) * 70, y: Math.sin(a) * 70, opacity: 0 }} transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }} />
        })}
      </div>
      <motion.h3 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-7 font-serif text-3xl font-black text-[#111827] dark:text-white">{title}</motion.h3>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-2 max-w-sm text-sm font-medium text-gray-500 dark:text-gray-400">{body}</motion.div>
      <button type="button" onClick={onClose} className="mt-7 text-[11px] font-black uppercase tracking-widest text-gray-400 transition hover:text-[#111827] dark:hover:text-white">Close</button>
    </motion.div>
  )
}

function PrimaryButton({ onClick, disabled, busy, children }: { onClick: () => void; disabled?: boolean; busy?: boolean; children: ReactNode }) {
  return (
    <motion.button type="button" whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} disabled={disabled || busy} onClick={onClick}
      className="gf-shine relative ml-auto inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[#111827] text-xs font-black uppercase tracking-widest text-white shadow-[0_16px_34px_-14px_rgba(17,24,39,.9)] transition-opacity disabled:opacity-40 dark:bg-white dark:text-[#111827] sm:flex-none sm:px-9">
      {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending</> : children}
    </motion.button>
  )
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={onClick} disabled={disabled}
      className="inline-flex h-12 items-center gap-1.5 rounded-2xl px-4 text-[11px] font-black uppercase tracking-widest text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
      <ArrowLeft className="h-4 w-4" /> Back
    </motion.button>
  )
}

/** Portal + presence for one of the flows below. */
function Portal({ open, children }: { open: boolean; children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  const release = usePagePin(open)
  if (!host) return null
  return createPortal(<AnimatePresence onExitComplete={release}>{open && children}</AnimatePresence>, host)
}

// ------------------------------------------------------------------ Request info

const TOPICS = ['Is it still available?', 'Price & offers', 'Taxes & HOA', 'Condition & updates', 'Disclosures', 'Something else']

export function InfoRequestWindow({ open, onClose, home }: { open: boolean; onClose: () => void; home: FlowHome }) {
  return <Portal open={open}><InfoFlow key="info" onClose={onClose} home={home} /></Portal>
}

function InfoFlow({ onClose, home }: { onClose: () => void; home: FlowHome }) {
  const [step, setStep] = useState<'ask' | 'you' | 'done'>('ask')
  const [dir, setDir] = useState(1)
  const [topics, setTopics] = useState<string[]>([])
  const [text, setText] = useState('')
  const c = useGuestContact()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)
  const agentFirst = home.agent?.name?.split(' ')[0] || 'The listing agent'
  useEffect(() => {
    if (step !== 'done') return
    const t = window.setTimeout(onClose, 3200)
    return () => window.clearTimeout(t)
  }, [step, onClose])
  const go = (s: typeof step) => { setDir(s === 'ask' ? -1 : 1); setStep(s); setError('') }
  const toggle = (t: string) => setTopics(cur => (cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]))
  const canAsk = topics.length > 0 || text.trim().length > 0
  const bad = { name: !c.name.trim(), email: !EMAIL_RE.test(c.email.trim()) }
  const send = async () => {
    setTried(true)
    if (bad.name || bad.email) { setError(bad.name ? 'Add your name so we know who to reply to.' : 'That email doesn’t look right.'); return }
    setBusy(true); setError('')
    c.remember()
    const message = [topics.length ? `About: ${topics.join(', ')}` : '', text.trim()].filter(Boolean).join('\n')
    try {
      if (home.siteId !== 'preview') {
        const res = await fetch(`/api/website-property-sites/${home.siteId}/inquiry`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...c.split(), email: c.email.trim(), phone: c.phone.trim() || null, message: message || null, came_from: visitSource(`site:${home.siteId}`) }),
        })
        if (!res.ok) throw new Error('send')
      }
      go('done')
    } catch {
      setError('That didn’t go through - please try again.')
    } finally {
      setBusy(false)
    }
  }
  const footer = step === 'ask'
    ? <PrimaryButton onClick={() => go('you')} disabled={!canAsk}>Continue <ArrowRight className="h-4 w-4" /></PrimaryButton>
    : <><BackButton onClick={() => go('ask')} disabled={busy} /><PrimaryButton onClick={send} busy={busy}><Send className="h-4 w-4" /> Send question</PrimaryButton></>
  return (
    <FlowShell home={home} kicker="Ask about this home" icon={<MessageSquare className="h-3.5 w-3.5" />} steps={['Your question', 'Your details', 'Sent']}
      stepNo={step === 'ask' ? 1 : step === 'you' ? 2 : 3} done={step === 'done'} onClose={onClose} busy={busy} footer={footer}>
      <AnimatePresence mode="popLayout" custom={dir} initial={false}>
        {step === 'ask' && (
          <motion.div key="ask" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" className="px-5 pb-5 sm:px-8">
            <StepHead no={1} of={2} title="What would you like to know?" />
            <div className="mt-3 flex flex-wrap gap-2">
              {TOPICS.map(t => {
                const on = topics.includes(t)
                return (
                  <motion.button key={t} type="button" whileTap={{ scale: 0.95 }} onClick={() => toggle(t)} aria-pressed={on}
                    className={`relative inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-bold transition-colors ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-[#111827] hover:border-[#C9A24D] dark:border-white/10 dark:text-white'}`}>
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}{t}
                  </motion.button>
                )
              })}
            </div>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Your question {topics.length ? '(optional)' : ''}</span>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder={`Ask ${agentFirst} anything about ${home.street}…`}
                className="block w-full resize-none rounded-2xl border border-gray-200 bg-[#FAFAF7] px-4 py-3 text-[16px] font-medium text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:border-white/10 dark:bg-[#0b0b0c] dark:text-white sm:text-sm" />
            </label>
          </motion.div>
        )}
        {step === 'you' && (
          <motion.div key="you" custom={dir} variants={slide} initial="initial" animate="animate" exit="exit" className="flex flex-col gap-3 px-5 pb-5 sm:px-8">
            <StepHead no={2} of={2} title={`Where should ${agentFirst} reply?`} />
            <FlowField label="Your name" value={c.name} onChange={c.setName} placeholder="First and last name" autoComplete="name" invalid={tried && bad.name} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FlowField label="Email" value={c.email} onChange={c.setEmail} placeholder="you@email.com" type="email" inputMode="email" autoComplete="email" invalid={tried && bad.email} />
              <FlowField label="Phone (optional)" value={c.phone} onChange={v => c.setPhone(formatPhone(v))} placeholder="(555) 000-0000" type="tel" inputMode="tel" autoComplete="tel" />
            </div>
            <div className="rounded-2xl border border-dashed border-[#C9A24D]/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a8843a] dark:text-[#e8c97a]">Your question</p>
              <p className="mt-1 line-clamp-3 text-[13px] font-bold text-[#111827] dark:text-white">{[topics.join(' · '), text.trim()].filter(Boolean).join(' - ')}</p>
            </div>
            {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-rose-600">{error}</motion.p>}
            <p className="text-[11px] leading-relaxed text-gray-400">By sending, you agree to be contacted by {home.agent?.name || 'the listing agent'} about this home. We never sell your information.</p>
          </motion.div>
        )}
        {step === 'done' && (
          <DoneMoment title="Question sent" onClose={onClose} body={<>{agentFirst} has your question about {home.street} and will get back to you soon.</>} />
        )}
      </AnimatePresence>
    </FlowShell>
  )
}

// ------------------------------------------------------------------ Documents

export interface SpotDocument { label: string; url: string }

export function DocumentRequestWindow({ open, onClose, home, documents, initial }: {
  open: boolean; onClose: () => void; home: FlowHome; documents: SpotDocument[]; initial: number
}) {
  return <Portal open={open}><DocsFlow key={`docs-${initial}`} onClose={onClose} home={home} documents={documents} initial={initial} /></Portal>
}

function DocsFlow({ onClose, home, documents, initial }: { onClose: () => void; home: FlowHome; documents: SpotDocument[]; initial: number }) {
  const [picked, setPicked] = useState<number[]>(() => (documents[initial] ? [initial] : documents.map((_, i) => i)))
  const c = useGuestContact()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tried, setTried] = useState(false)
  const [done, setDone] = useState(false)
  const bad = { name: !c.name.trim(), email: !EMAIL_RE.test(c.email.trim()), phone: c.phone.replace(/\D/g, '').length < 10, docs: picked.length === 0 }
  const toggle = (i: number) => setPicked(cur => (cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i].sort((a, b) => a - b)))
  const send = async () => {
    setTried(true)
    if (bad.docs) { setError('Pick at least one document.'); return }
    if (bad.name || bad.email || bad.phone) {
      setError(bad.name ? 'Add your name.' : bad.email ? 'That email doesn’t look right.' : 'Add a phone number in case the email is delayed.')
      return
    }
    setBusy(true); setError('')
    c.remember()
    try {
      if (home.siteId !== 'preview') {
        const res = await fetch(`/api/website-property-sites/${home.siteId}/documents`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: c.name.trim(), email: c.email.trim(), phone: c.phone.trim(), documents: picked.map(i => documents[i].url), came_from: visitSource(`site:${home.siteId}`) }),
        })
        if (!res.ok) throw new Error('send')
      }
      setDone(true)
    } catch {
      setError('That didn’t go through - please try again.')
    } finally {
      setBusy(false)
    }
  }
  const many = documents.length > 1
  return (
    <FlowShell home={home} kicker="Documents" icon={<FileText className="h-3.5 w-3.5" />} steps={['Your details', 'On its way']} stepNo={done ? 2 : 1} done={done}
      onClose={onClose} busy={busy}
      footer={<PrimaryButton onClick={send} busy={busy}><Mail className="h-4 w-4" /> Email {picked.length > 1 ? `the ${picked.length} documents` : 'it to me'}</PrimaryButton>}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!done ? (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -28, transition: { duration: 0.16 } }} className="flex flex-col gap-3 px-5 pb-5 sm:px-8">
            <StepHead no={1} of={1} title="Where should we send it?" />
            <div className="grid gap-2">
              {documents.map((d, i) => {
                const on = picked.includes(i)
                const cls = `flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors ${on ? 'border-[#C9A24D] bg-[#C9A24D]/[0.08]' : 'border-gray-200 dark:border-white/10'}`
                const inner = (
                  <>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#111827] text-[#e8c97a]"><FileText className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-black text-[#111827] dark:text-white">{d.label || 'Document'}</span>
                      <span className="block text-[11px] font-semibold text-gray-400">{/\.pdf($|\?)/i.test(d.url) ? 'PDF' : 'Link'} · sent to your email</span>
                    </span>
                    {many && (
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${on ? 'border-[#C9A24D] bg-[#C9A24D] text-[#111827]' : 'border-gray-300 dark:border-white/20'}`}>
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                    )}
                  </>
                )
                return many
                  ? <motion.button key={i} type="button" onClick={() => toggle(i)} whileTap={{ scale: 0.98 }} aria-pressed={on} className={cls}>{inner}</motion.button>
                  : <div key={i} className={cls}>{inner}</div>
              })}
            </div>
            <FlowField label="Your name" value={c.name} onChange={c.setName} placeholder="First and last name" autoComplete="name" invalid={tried && bad.name} />
            <div className="grid gap-3 sm:grid-cols-2">
              <FlowField label="Email" value={c.email} onChange={c.setEmail} placeholder="you@email.com" type="email" inputMode="email" autoComplete="email" invalid={tried && bad.email} />
              <FlowField label="Phone" value={c.phone} onChange={v => c.setPhone(formatPhone(v))} placeholder="(555) 000-0000" type="tel" inputMode="tel" autoComplete="tel" invalid={tried && bad.phone} />
            </div>
            {error && <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-xs font-bold text-rose-600">{error}</motion.p>}
            <p className="text-[11px] leading-relaxed text-gray-400">{home.agent?.name || 'The listing agent'} will see that you asked for {picked.length > 1 ? 'these' : 'this'}. We never sell your information.</p>
          </motion.div>
        ) : (
          <DoneMoment icon="mail" title="Check your inbox" onClose={onClose}
            body={<>You&apos;ll get an email any moment with {picked.length > 1 ? 'the documents' : 'the document'} for {home.street}. <b className="text-[#111827] dark:text-white">Don&apos;t see it? Check your junk or spam folder too.</b></>} />
        )}
      </AnimatePresence>
    </FlowShell>
  )
}

const FLOW_CSS = `
.gf-ken{animation:gfKen 16s ease-out both}
@keyframes gfKen{from{transform:scale(1.15)}to{transform:scale(1.02)}}
.gf-edge{background:linear-gradient(90deg,transparent 10%,#e8c97a 50%,transparent 90%);transform:translateX(-100%);animation:gfEdge 6s ease-in-out infinite;will-change:transform}
@keyframes gfEdge{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
.gf-spark{width:4px;height:4px;border-radius:999px;background:#e8c97a;box-shadow:0 0 10px 2px #e8c97a;opacity:0;animation:gfSpark 7s ease-in-out infinite}
@keyframes gfSpark{0%{opacity:0;transform:translateY(0) scale(.5)}30%{opacity:.9;transform:translateY(-16px) scale(1)}100%{opacity:0;transform:translateY(-60px) scale(.5)}}
.gf-shine:after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.45) 50%,transparent 65%);transform:translateX(-100%);animation:gfShine 3.4s ease-in-out infinite}
@keyframes gfShine{0%,55%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
@media (prefers-reduced-motion:reduce){.gf-ken,.gf-edge,.gf-spark,.gf-shine:after{animation:none}}
`
