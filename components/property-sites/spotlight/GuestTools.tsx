'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BellRing, Check, FileText, Loader2, Printer, X } from 'lucide-react'
import FormQrCode from '@/components/forms/FormQrCode'
import { fmtMoney, fmtNumber, fmtPhone, type SpotlightModel } from './model'
import { prettyFeature } from './features'

// Two things guests keep asking for, side by side above "Get in touch" on both templates:
// - Follow this home: name + email -> an email only when the price changes, an open house is
//   scheduled, or it goes under contract (a real lead for the agent; see spotlight_alerts_service).
// - Take the facts with you: a one-page fact sheet (photo, price, key facts, schools, QR back to
//   the page, the agent) that prints / saves as a PDF.
export default function GuestTools({ m, siteId, url, tone }: { m: SpotlightModel; siteId: string; url: string; tone: 'dark' | 'paper' }) {
  const [sheet, setSheet] = useState(false)
  const dark = tone === 'dark'
  const canFollow = m.status?.kind !== 'sold'
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
          <button onClick={() => setSheet(true)} className="gt-btn gt-btn-ghost"><Printer className="h-4 w-4" /> Get the fact sheet</button>
        </div>
      </div>
      {sheet && <FactSheet m={m} url={url} onClose={() => setSheet(false)} />}
    </section>
  )
}

function FollowCard({ m, siteId, dark }: { m: SpotlightModel; siteId: string; dark: boolean }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const valid = /\S+@\S+\.\S+/.test(email.trim())
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || state === 'sending') return
    setState('sending')
    if (siteId === 'preview') { window.setTimeout(() => setState('done'), 600); return }
    try {
      const res = await fetch(`/api/website-property-sites/${siteId}/alerts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      setState(res.ok ? 'done' : 'error')
    } catch {
      setState('error')
    }
  }
  return (
    <div className="gt-card gt-follow sp-loop">
      <div className="gt-follow-glow" aria-hidden />
      <span className="gt-icon gt-bell"><BellRing className="h-5 w-5" strokeWidth={1.5} /></span>
      <h3 className="sp-display mt-5 text-[1.9rem] leading-tight">Follow this home</h3>
      <p className="mt-2 max-w-md text-[15px] leading-relaxed gt-muted">
        Get an email if the price changes, an open house is scheduled, or it goes under contract. Nothing else.
      </p>
      {state === 'done' ? (
        <p className="gt-done mt-6"><span><Check className="h-4 w-4" /></span> You&apos;re on the list - we&apos;ll email you when anything changes.</p>
      ) : (
        <form onSubmit={submit} className="mt-6 grid gap-2.5 sm:grid-cols-[1fr_1.3fr_auto]">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="First name" autoComplete="given-name" className="gt-input" aria-label="First name" />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email" className="gt-input" aria-label="Email" required />
          <button type="submit" disabled={!valid || state === 'sending'} className="gt-btn">
            {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Notify me
          </button>
        </form>
      )}
      {state === 'error' && <p className="mt-2 text-sm text-red-400">That didn&apos;t go through - please try again.</p>}
      <p className={`mt-3 text-[11px] gt-faint ${dark ? '' : ''}`}>{m.agent?.name ? `${m.agent.name} will also see that you're interested. ` : ''}Unsubscribe any time.</p>
    </div>
  )
}

function FactSheet({ m, url, onClose }: { m: SpotlightModel; url: string; onClose: () => void }) {
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
  const { p } = m
  const stats = [
    p.beds != null && [fmtNumber(p.beds), 'Beds'],
    p.baths != null && [fmtNumber(p.baths), 'Baths'],
    p.sqft && [fmtNumber(p.sqft), 'Sq ft'],
    p.lot_size_acres && [fmtNumber(p.lot_size_acres), 'Acres'],
    p.year_built && [String(p.year_built), 'Built'],
  ].filter(Boolean) as [string, string][]
  // One printed page: the facts a buyer compares on, not every MLS field.
  const facts = m.keyFacts.filter(f => !['Status', 'Bedrooms', 'Bathrooms', 'Interior', 'Year built', 'MLS #', 'Days on market', 'Subdivision', 'Property type'].includes(f.label)).slice(0, 14)
  const schools = m.schools
  const agent = m.agent
  return createPortal(
    <div className="fs-overlay" role="dialog" aria-modal="true" aria-label="Fact sheet">
      <style>{FS_CSS}</style>
      <div className="fs-bar">
        <p>Fact sheet · {p.address.split(',')[0]}</p>
        <div>
          <button onClick={() => window.print()} className="fs-print"><Printer className="h-4 w-4" /> Print or save as PDF</button>
          <button onClick={onClose} className="fs-close" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="fs-scroll">
        <article id="ohp-factsheet" className="fs-page">
          {m.heroImage && <img src={m.heroImage} alt="" className="fs-hero" />}
          <div className="fs-head">
            <div>
              <p className="fs-kicker">{[m.status?.label, m.cityState].filter(Boolean).join(' · ')}</p>
              <h1>{p.address.split(',')[0]}</h1>
              <p className="fs-place">{m.fullAddress.split(',').slice(1).join(',').trim()}</p>
            </div>
            {fmtMoney(p.price) && <p className="fs-price">{fmtMoney(p.price)}</p>}
          </div>
          <div className="fs-stats">{stats.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>
          <div className="fs-cols">
            <section>
              <h2>The details</h2>
              <dl>{facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
            </section>
            <section>
              {m.featured.length > 0 && (
                <>
                  <h2>Stand-out features</h2>
                  <ul>{m.featured.slice(0, 8).map(x => <li key={x}>{prettyFeature(x)}</li>)}</ul>
                </>
              )}
              {schools.length > 0 && (
                <>
                  <h2>Schools</h2>
                  <dl>{schools.map(sc => <div key={sc.level}><dt>{sc.level}</dt><dd>{sc.name}</dd></div>)}</dl>
                </>
              )}
              <div className="fs-agentbox">
                {agent && (
                  <div className="fs-agent">
                    {agent.photo_url && <img src={agent.photo_url} alt="" />}
                    <div>
                      <b>{agent.name}</b>
                      <span>{[agent.brokerage, fmtPhone(agent.phone), agent.email].filter(Boolean).join(' · ')}</span>
                    </div>
                  </div>
                )}
                <div className="fs-qr"><FormQrCode url={url} size={78} /><span>Scan to see every photo</span></div>
              </div>
            </section>
          </div>
          <p className="fs-note">Information deemed reliable but not guaranteed. Please verify anything important.</p>
        </article>
      </div>
    </div>,
    document.body,
  )
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
.gt-done{display:flex;align-items:center;gap:10px;font-size:15px}
.gt-done span{display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;border-radius:999px;background:#22c55e;color:#fff;animation:gtPop .5s cubic-bezier(.34,1.56,.64,1) both}
@keyframes gtPop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
@media(prefers-reduced-motion:reduce){.gt-bell svg,.gt-done span{animation:none}}
`

const FS_CSS = `
.fs-overlay{position:fixed;inset:0;z-index:140;display:flex;flex-direction:column;background:rgba(20,18,16,.82);font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
.fs-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;color:#fff;font-size:14px;font-weight:600}
.fs-bar>div{display:flex;align-items:center;gap:8px}
.fs-print{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:999px;background:#fff;color:#111;font-weight:700;font-size:13px}
.fs-close{display:inline-flex;width:40px;height:40px;align-items:center;justify-content:center;border-radius:999px;color:#fff}
.fs-close:hover{background:rgba(255,255,255,.12)}
.fs-scroll{flex:1;overflow:auto;padding:8px 12px 32px}
.fs-page{max-width:800px;margin:0 auto;background:#fff;color:#1c1917;padding:32px;box-shadow:0 30px 80px -20px rgba(0,0,0,.6)}
.fs-hero{width:100%;aspect-ratio:16/7;object-fit:cover;display:block}
.fs-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:22px;padding-bottom:16px;border-bottom:2px solid #1c1917}
.fs-kicker{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#8b7355;font-weight:700}
.fs-head h1{font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.05;margin-top:6px}
.fs-place{font-size:13px;color:#78716c;margin-top:4px}
#ohp-factsheet .fs-price{font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1}
.fs-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));border-bottom:1px solid #e7e5e4}
.fs-stats div{padding:14px 0;text-align:center;border-right:1px solid #e7e5e4}
.fs-stats div:last-child{border-right:0}
.fs-stats b{display:block;font-family:Georgia,serif;font-size:22px;font-weight:400}
.fs-stats span{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#78716c}
.fs-cols{display:grid;gap:28px;margin-top:22px}
@media(min-width:640px){.fs-cols{grid-template-columns:1.2fr 1fr}}
.fs-cols h2{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#8b7355;font-weight:800;margin:0 0 8px}
.fs-cols section h2:not(:first-child){margin-top:20px}
.fs-cols dl div{display:flex;justify-content:space-between;gap:16px;padding:6px 0;border-bottom:1px solid #f0eeec;font-size:12.5px}
.fs-cols dt{color:#78716c}
.fs-cols dd{text-align:right;font-weight:600}
.fs-cols ul{columns:2;column-gap:16px;font-size:12.5px}
.fs-cols li{padding:4px 0 4px 12px;position:relative;break-inside:avoid}
.fs-cols li:before{content:"";position:absolute;left:0;top:10px;width:5px;height:5px;background:#8b7355;transform:rotate(45deg)}
.fs-agentbox{margin-top:22px;padding-top:16px;border-top:2px solid #1c1917;display:flex;flex-direction:column;gap:14px}
.fs-agent{display:flex;align-items:center;gap:12px}
.fs-agent img{width:52px;height:52px;border-radius:999px;object-fit:cover}
.fs-agent b{display:block;font-size:15px}
.fs-agent span{font-size:12px;color:#57534e}
.fs-qr{display:flex;align-items:center;gap:10px;font-size:11px;color:#57534e}
.fs-note{margin-top:14px;font-size:9.5px;color:#a8a29e}
@media print{
  @page{margin:12mm}
  body>*:not(.fs-overlay){display:none!important}
  .fs-bar{display:none!important}
  html,body{height:auto!important;overflow:visible!important;background:#fff!important}
  .fs-overlay{position:static!important;background:none!important;backdrop-filter:none!important;display:block!important}
  .fs-scroll{overflow:visible!important;padding:0!important}
  #ohp-factsheet{width:100%;max-width:none;box-shadow:none;padding:0;margin:0}
  .fs-hero{aspect-ratio:16/5.2}
  #ohp-factsheet .fs-price{font-size:28px!important;font-family:Georgia,'Times New Roman',serif!important}
  #ohp-factsheet .fs-head h1{font-size:32px!important}
  .fs-head{margin-top:14px;padding-bottom:10px}
  .fs-cols{margin-top:14px;gap:22px}
  .fs-cols dl div{padding:4px 0}
  #ohp-factsheet{break-inside:avoid}
}
`
