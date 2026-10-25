'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { ArrowUpRight, BellRing, Check, FileText, Loader2, Printer } from 'lucide-react'
import type { SpotlightModel } from './model'
import SpotSheet, { useCompactScreen } from './SpotSheet'

// The fact sheet (and its PDF maker) only loads when someone opens it in an editor preview.
const SpotlightFactSheet = dynamic(() => import('../SpotlightFactSheet'), { ssr: false })
import { formatPhone } from './GuestFlows'
import { readVisitor, saveVisitor } from '@/lib/visitor'
import { visitSource } from '@/lib/visitSource'

// Two things guests keep asking for, side by side above "Get in touch" on both templates:
// - Follow this home: name + email -> an email only when the price changes, an open house is
//   scheduled, or it goes under contract (a real lead for the agent; see spotlight_alerts_service).
// - Take the facts with you: a one-page fact sheet (photo, price, key facts, schools, QR back to
//   the page, the agent) that prints / saves as a PDF.
export default function GuestTools({ m, siteId, url, tone }: { m: SpotlightModel; siteId: string; url: string; tone: 'dark' | 'paper' }) {
  const [sheet, setSheet] = useState(false)
  const dark = tone === 'dark'
  const canFollow = m.status?.kind !== 'sold'
  // The fact sheet opens in its own tab (user, 10/24 - never take them off the listing): the live
  // page's …/fact-sheet. The editor's previews (no live address yet) show it over the page instead.
  const openFactSheet = () => {
    const path = window.location.pathname
    if (siteId === 'preview' || path.startsWith('/spotlight-preview') || path.startsWith('/studio')) { setSheet(true); return }
    window.open(`${path.replace(/\/+$/, '')}/fact-sheet`, '_blank', 'noopener')
  }
  return (
    <section id="guest-tools" className={`gt gt-${tone} scroll-mt-16 px-5 py-16 sm:px-10 sm:py-20`}>
      <style>{GT_CSS}</style>
      <div className={`mx-auto grid max-w-6xl gap-4 ${canFollow ? 'lg:grid-cols-[1.35fr_1fr]' : ''}`}>
        {canFollow && <FollowCard m={m} siteId={siteId} dark={dark} />}
        <div className="gt-card flex flex-col justify-between gap-6">
          <div>
            <span className="gt-icon"><FileText className="h-5 w-5" strokeWidth={1.5} /></span>
            <h3 className="sp-display mt-5 text-[1.9rem] leading-tight">Take the facts with you</h3>
            <p className="mt-2 text-[15px] leading-relaxed gt-muted">Price, key details, schools and taxes on one page - print it or save it as a PDF.</p>
          </div>
          <button onClick={openFactSheet} className="gt-btn gt-btn-ghost"><Printer className="h-4 w-4" /> Get the fact sheet <ArrowUpRight className="h-3.5 w-3.5 opacity-60" /></button>
        </div>
      </div>
      {sheet && <FactSheetOverlay m={m} url={url} onClose={() => setSheet(false)} />}
    </section>
  )
}

// Follow this home (user, 10/24): name, email AND phone. A computer keeps the form right in the
// card; a phone gets one "Follow this home" button that slides the form up from the bottom.
function FollowCard({ m, siteId, dark }: { m: SpotlightModel; siteId: string; dark: boolean }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [sheet, setSheet] = useState(false)
  const compact = useCompactScreen()
  // What the visitor already told the site (a question, the documents...) fills in here too.
  useEffect(() => {
    const v = readVisitor()
    if (!v) return
    setName(n => n || v.name || '')
    setEmail(e => e || v.email || '')
    setPhone(p => p || (v.phone ? formatPhone(v.phone) : ''))
  }, [sheet])
  // The sheet says "done" for a moment, then slides away by itself.
  useEffect(() => {
    if (state !== 'done' || !sheet) return
    const t = window.setTimeout(() => setSheet(false), 2400)
    return () => window.clearTimeout(t)
  }, [state, sheet])
  const valid = /\S+@\S+\.\S+/.test(email.trim())
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || state === 'sending') return
    setState('sending')
    saveVisitor({ name: name.trim(), email: email.trim(), phone: phone.trim() || undefined })
    if (siteId === 'preview') { window.setTimeout(() => setState('done'), 600); return }
    try {
      const res = await fetch(`/api/website-property-sites/${siteId}/alerts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() || null, came_from: visitSource(`site:${siteId}`) }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }
  const fields = (stacked: boolean) => (
    <form onSubmit={submit} className={`grid gap-2.5 ${stacked ? '' : 'sm:grid-cols-2'}`}>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" className="gt-input" aria-label="Your name" />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" inputMode="email" autoComplete="email" className="gt-input" aria-label="Email" required />
      <input value={phone} onChange={e => setPhone(formatPhone(e.target.value))} placeholder="Phone (for a quick text)" type="tel" inputMode="tel" autoComplete="tel" className="gt-input" aria-label="Phone" />
      <button type="submit" disabled={!valid || state === 'sending'} className="gt-btn">
        {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Notify me
      </button>
    </form>
  )
  const done = <p className="gt-done"><span><Check className="h-4 w-4" /></span> You&apos;re on the list - we&apos;ll email you when anything changes.</p>
  const error = state === 'error' && <p className="mt-2 text-sm text-red-400">That didn&apos;t go through - please try again.</p>
  const fine = <p className="mt-3 text-[11px] gt-faint">{m.agent?.name ? `${m.agent.name} will also see that you're interested. ` : ''}Unsubscribe any time.</p>
  return (
    <div className="gt-card gt-follow sp-loop">
      <div className="gt-follow-glow" aria-hidden />
      <span className="gt-icon gt-bell"><BellRing className="h-5 w-5" strokeWidth={1.5} /></span>
      <h3 className="sp-display mt-5 text-[1.9rem] leading-tight">Follow this home</h3>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed gt-muted">
        Get an email if the price changes, an open house is scheduled, or it goes under contract. Nothing else.
      </p>
      {state === 'done' ? <div className="mt-6">{done}</div> : compact ? (
        <button type="button" onClick={() => setSheet(true)} className="gt-btn mt-6 w-full"><BellRing className="h-4 w-4" /> Follow this home</button>
      ) : (
        <div className="mt-6">{fields(false)}{error}</div>
      )}
      {(!compact || state === 'done') && fine}
      {compact && (
        <SpotSheet open={sheet} onClose={() => setSheet(false)} tone={dark ? 'dark' : 'light'} kicker="Follow this home" title={m.p.address.split(',')[0]}>
          <div className={`gt gt-${dark ? 'dark' : 'paper'} gt-insheet`}>
            {state === 'done' ? <div className="py-4">{done}</div> : (
              <>
                <p className="-mt-1 mb-4 text-[14px] leading-relaxed gt-muted">An email when the price changes, an open house is set, or it goes under contract. Nothing else.</p>
                {fields(true)}
                {error}
              </>
            )}
            {fine}
          </div>
        </SpotSheet>
      )}
    </div>
  )
}

// Editor previews only (no live address to open in a tab): the same fact sheet page, over the page.
function FactSheetOverlay({ m, url, onClose }: { m: SpotlightModel; url: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey) }
  }, [onClose])
  if (!mounted) return null
  return createPortal(<SpotlightFactSheet model={m} publicUrl={url} onClose={onClose} />, document.body)
}

const GT_CSS = `
.gt-dark{background:#0A0A0A;color:#fff;--gt-line:rgba(255,255,255,.1);--gt-card:rgba(255,255,255,.035)}
.gt-paper{background:#efe9dd;color:#172522;--gt-line:rgba(23,37,34,.14);--gt-card:#f7f3ea}
.gt .gt-muted{color:color-mix(in srgb,currentColor 62%,transparent)}
.gt .gt-faint{color:color-mix(in srgb,currentColor 45%,transparent)}
.gt-card{position:relative;overflow:hidden;border:1px solid var(--gt-line);background:var(--gt-card);padding:2rem}
@media(min-width:640px){.gt-card{padding:2.4rem}}
.gt-paper .gt-card{border-radius:0}
.gt-dark .gt-card{border-radius:4px}
.gt-icon{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:999px;border:1px solid color-mix(in srgb,var(--sp-accent,#C9A24D) 55%,transparent);color:var(--sp-accent,#C9A24D)}
.gt-bell svg{transform-origin:50% 10%;animation:gtRing 3.2s ease-in-out infinite}
@keyframes gtRing{0%,70%,100%{transform:rotate(0)}74%{transform:rotate(14deg)}78%{transform:rotate(-12deg)}82%{transform:rotate(8deg)}86%{transform:rotate(-5deg)}}
.gt-follow-glow{position:absolute;right:-20%;top:-60%;width:70%;height:180%;background:radial-gradient(circle,color-mix(in srgb,var(--sp-accent,#C9A24D) 18%,transparent),transparent 65%);pointer-events:none}
.gt-input{width:100%;height:48px;padding:0 14px;border:1px solid var(--gt-line);background:transparent;color:inherit;font-size:15px;outline:none;transition:border-color .2s}
.gt-dark .gt-input{border-radius:999px;padding:0 18px;background:rgba(255,255,255,.04)}
.gt-input:focus{border-color:var(--sp-accent,#C9A24D)}
.gt-input::placeholder{color:color-mix(in srgb,currentColor 45%,transparent)}
.gt-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;padding:0 22px;font-size:14px;font-weight:600;background:var(--sp-accent,#C9A24D);color:var(--sp-on-accent,#111);transition:filter .2s,transform .2s;white-space:nowrap}
.gt-dark .gt-btn{border-radius:999px}
.gt-paper .gt-btn{background:#172522;color:#f3efe6;letter-spacing:.14em;text-transform:uppercase;font-size:11px}
.gt-btn:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px)}
.gt-btn:disabled{opacity:.5;cursor:not-allowed}
.gt-btn-ghost{background:transparent!important;color:inherit!important;border:1px solid var(--gt-line);align-self:flex-start}
.gt-btn-ghost:hover{border-color:var(--sp-accent,#C9A24D)!important}
.gt.gt-insheet{background:transparent}
.gt-done{display:flex;align-items:center;gap:10px;font-size:15px}
.gt-done span{display:inline-flex;flex-shrink:0;width:28px;height:28px;align-items:center;justify-content:center;border-radius:999px;background:#22c55e;color:#fff;animation:gtPop .5s cubic-bezier(.34,1.56,.64,1) both}
@keyframes gtPop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
@media(prefers-reduced-motion:reduce){.gt-bell svg,.gt-done span{animation:none}}
`
