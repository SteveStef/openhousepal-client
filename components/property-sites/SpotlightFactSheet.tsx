'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Download, Loader2, Printer, X } from 'lucide-react'
import FormQrCode from '@/components/forms/FormQrCode'
import { usePdfFile } from '@/lib/pdfFile'
import { buildSpotlight, type PropertySiteResolveResponse, type SpotlightModel } from './spotlight/model'
import { factSheetData } from './spotlight/factSheetData'
import FactSheetPdf from './spotlight/FactSheetPdf'

// The Spotlight's one-page fact sheet ("cheat sheet"), on its own page in a new tab (user, 10/24:
// it used to open over the listing). What's on screen IS the printed page: one US Letter sheet,
// scaled down to fit a phone. A solid bar fixed at the top says what it is and has Print and Save
// PDF; the bar never prints. Save PDF builds a real PDF file (react-pdf), ahead of time on iPhone.
// `onClose` set = shown over the editor's preview instead of on its own page.
export default function SpotlightFactSheet({ data, model, publicUrl, onClose }: {
  data?: PropertySiteResolveResponse
  /** The template's own model (the editor-preview overlay) instead of the raw page data. */
  model?: SpotlightModel
  publicUrl: string
  onClose?: () => void
}) {
  const m = useMemo(() => model || buildSpotlight(data!), [model, data])
  const d = useMemo(() => factSheetData(m), [m])
  const fileName = `Fact-sheet-${d.street.replace(/[^a-z0-9]+/gi, '-')}.pdf`
  const pdf = usePdfFile(() => <FactSheetPdf d={d} url={publicUrl} />, fileName, `${d.street}:${d.price}:${d.hero}`, true)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const savePdf = async () => {
    setBusy(true); setFailed(false)
    try { await pdf.run('share') } catch { setFailed(true) } finally { setBusy(false) }
  }

  // Back to the listing on whatever address this tab is on (…/fact-sheet -> …).
  const [listingHref, setListingHref] = useState(publicUrl)
  useEffect(() => { setListingHref(window.location.pathname.replace(/\/fact-sheet\/?$/, '') || '/') }, [])

  // The page is a real 8.5 x 11 in sheet (816 x 1056 px); on a narrow screen it's scaled down.
  const wrapRef = useRef<HTMLDivElement>(null)
  // --fs is set by a tiny inline script the moment the HTML arrives (FIT_SCRIPT), so a phone never
  // sees the full-size page first; this keeps it right when the screen turns.
  useEffect(() => {
    const fit = () => wrapRef.current?.style.setProperty('--fs', String(fitScale()))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const pdfLabel = pdf.iosHint === 'preparing' ? 'Preparing…' : pdf.iosHint === 'tap' ? 'Tap to save' : 'Save PDF'
  return (
    <div className={`fsx ${onClose ? 'fsx-over' : ''}`}>
      <style>{FSX_CSS}</style>
      <header className="fsx-bar" role="banner">
        <div className="fsx-bar-in">
          <div className="fsx-title">
            <b>Fact sheet</b>
            <span>{d.street}{d.place ? `, ${d.place}` : ''}</span>
          </div>
          <div className="fsx-actions">
            <button type="button" onClick={() => window.print()} className="fsx-btn" aria-label="Print the fact sheet"><Printer className="h-4 w-4" /><span>Print</span></button>
            <button type="button" onClick={savePdf} disabled={busy} className="fsx-btn is-primary" aria-label="Save the fact sheet as a PDF">
              {busy || pdf.iosHint === 'preparing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}<span>{pdfLabel}</span>
            </button>
            {onClose ? (
              <button type="button" onClick={onClose} className="fsx-icon" aria-label="Close"><X className="h-5 w-5" /></button>
            ) : (
              <a href={listingHref} className="fsx-link">
                <span>The listing</span> <ArrowUpRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
        {failed && <p className="fsx-err">The PDF couldn&apos;t be made just now - try again, or use Print and choose “Save as PDF”.</p>}
      </header>

      <main className="fsx-stage" ref={wrapRef} suppressHydrationWarning>
        {/* Server-rendered page only - in the editor overlay React draws it in the browser, where a
            script tag never runs (and warns); the effect above sets the size there. */}
        {!onClose && <script dangerouslySetInnerHTML={{ __html: FIT_SCRIPT }} />}
        <div className="fsx-fit">
          <article id="ohp-factsheet" className="fsx-page">
            {d.hero && <img src={d.hero} alt="" className="fsx-hero" />}
            <div className="fsx-head">
              <div className="min-w-0">
                {d.kicker && <p className="fsx-kicker">{d.kicker}</p>}
                <h1>{d.street}</h1>
                {d.place && <p className="fsx-place">{d.place}</p>}
              </div>
              {d.price && <div className="fsx-price"><span>{d.priceLabel}</span><b>{d.price}</b></div>}
            </div>
            {d.stats.length > 0 && <div className="fsx-stats">{d.stats.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}</div>}
            <div className="fsx-cols">
              <section>
                <h2>The details</h2>
                <dl>{d.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
              </section>
              <section>
                {d.features.length > 0 && (
                  <>
                    <h2>Stand-out features</h2>
                    <ul>{d.features.map(x => <li key={x}>{x}</li>)}</ul>
                  </>
                )}
                {d.schools.length > 0 && (
                  <>
                    <h2>Schools</h2>
                    <dl>{d.schools.map(sc => <div key={sc.level}><dt>{sc.level}</dt><dd>{sc.name}</dd></div>)}</dl>
                  </>
                )}
                <div className="fsx-agent">
                  {d.agent?.photo && <img src={d.agent.photo} alt="" />}
                  <div className="min-w-0 flex-1">
                    {d.agent && <b>{d.agent.name}</b>}
                    {d.agent?.line && <span>{d.agent.line}</span>}
                    {d.agent?.email && <span>{d.agent.email}</span>}
                    {d.agent?.license && <span>Lic. #{d.agent.license}</span>}
                  </div>
                  {/* Fixed box: the canvas is 300px wide until the code is drawn into it. */}
                  <div className="fsx-qr"><div className="h-16 w-16 overflow-hidden"><FormQrCode url={publicUrl} size={64} bare /></div><span>Every photo</span></div>
                </div>
              </section>
            </div>
            <p className="fsx-note"><span>Information deemed reliable but not guaranteed. Please verify anything important.</span><span>{d.mls}</span></p>
          </article>
        </div>
      </main>
    </div>
  )
}

function fitScale() { return Math.min(1, (window.innerWidth - (window.innerWidth < 640 ? 20 : 64)) / 816) }
const FIT_SCRIPT = "try{var w=innerWidth;document.currentScript.parentNode.style.setProperty('--fs',String(Math.min(1,(w-(w<640?20:64))/816)))}catch(e){}"

const FSX_CSS = `
.fsx{min-height:100vh;background:#e8e6e1;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1c1917}
.fsx-over{position:fixed;inset:0;z-index:170;overflow-y:auto}
.fsx-bar{position:fixed;inset:0 0 auto 0;z-index:20;background:#15171b;color:#fff;box-shadow:0 8px 24px -12px rgba(0,0,0,.55);border-bottom:1px solid #2a2d33}
.fsx-over .fsx-bar{position:sticky}
.fsx-bar-in{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;padding-top:max(10px,env(safe-area-inset-top))}
.fsx-title{min-width:0;display:flex;flex-direction:column;line-height:1.2}
.fsx-title b{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#d9b864}
.fsx-title span{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fsx-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.fsx-btn{display:inline-flex;align-items:center;gap:7px;height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.22);font-size:13px;font-weight:700;color:#fff;background:transparent;transition:background .2s,border-color .2s}
.fsx-btn:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.4)}
.fsx-btn.is-primary{background:#d9b864;border-color:#d9b864;color:#15171b}
.fsx-btn.is-primary:hover{background:#e5c677}
.fsx-btn:disabled{opacity:.7}
.fsx-icon{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:999px;color:#fff}
.fsx-icon:hover{background:rgba(255,255,255,.1)}
.fsx-link{display:inline-flex;align-items:center;gap:4px;font-size:13px;font-weight:600;color:rgba(255,255,255,.75);padding:0 6px}
.fsx-link:hover{color:#fff}
@media(max-width:639px){.fsx-btn{padding:0 12px}.fsx-btn span{display:none}.fsx-btn.is-primary span{display:inline}.fsx-link span{display:none}.fsx-title span{font-size:13px}}
.fsx-err{max-width:1100px;margin:0 auto;padding:0 16px 10px;font-size:12px;color:#fca5a5}
.fsx-stage{padding:84px 10px 40px;display:flex;justify-content:center}
@media(min-width:640px){.fsx-stage{padding:96px 32px 56px}}
.fsx-over .fsx-stage{padding-top:24px}
.fsx-fit{position:relative;flex-shrink:0;width:calc(816px * var(--fs,1));height:calc(1056px * var(--fs,1))}
.fsx-page{position:absolute;left:0;top:0;width:816px;height:1056px;overflow:hidden;transform-origin:0 0;transform:scale(var(--fs,1));background:#fff;padding:44px 46px 40px;box-shadow:0 30px 80px -24px rgba(0,0,0,.45);box-sizing:border-box}
.fsx-hero{display:block;width:100%;height:290px;object-fit:cover}
.fsx-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:18px;padding-bottom:12px;border-bottom:2px solid #1c1917}
.fsx-kicker{font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#8b7355;font-weight:700}
.fsx-head h1{font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.05;margin-top:5px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fsx-place{font-size:13px;color:#78716c;margin-top:3px}
.fsx-price{text-align:right;flex-shrink:0}
.fsx-price span{display:block;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#78716c}
.fsx-price b{display:block;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;line-height:1.1}
.fsx-stats{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;border-bottom:1px solid #e7e5e4}
.fsx-stats div{padding:10px 0;text-align:center;border-right:1px solid #e7e5e4}
.fsx-stats div:last-child{border-right:0}
.fsx-stats b{display:block;font-family:Georgia,serif;font-size:20px;font-weight:400}
.fsx-stats span{font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:#78716c}
.fsx-cols{display:grid;grid-template-columns:minmax(0,384px) minmax(0,1fr);gap:26px;margin-top:18px}
.fsx-page,.fsx-page *{-webkit-text-size-adjust:100%;text-size-adjust:100%}
.fsx-cols h2{font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;color:#8b7355;font-weight:800;margin:0 0 6px}
.fsx-cols section h2:not(:first-child){margin-top:16px}
.fsx-cols dl div{display:flex;justify-content:space-between;gap:14px;padding:5px 0;border-bottom:1px solid #f0eeec;font-size:12px;line-height:1.3}
.fsx-cols dt{color:#78716c;flex-shrink:0}
.fsx-cols dd{text-align:right;font-weight:600}
.fsx-cols ul{columns:2;column-gap:14px;font-size:12px}
.fsx-cols li{padding:3px 0 3px 12px;position:relative;break-inside:avoid;line-height:1.3}
.fsx-cols li:before{content:"";position:absolute;left:0;top:8px;width:5px;height:5px;background:#8b7355;transform:rotate(45deg)}
.fsx-agent{margin-top:16px;padding-top:12px;border-top:2px solid #1c1917;display:flex;align-items:center;gap:10px}
.fsx-agent>img{width:46px;height:46px;border-radius:999px;object-fit:cover;flex-shrink:0}
.fsx-agent b{display:block;font-size:14px}
.fsx-agent span{display:block;font-size:11px;color:#57534e;line-height:1.35}
.fsx-qr{display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0}
.fsx-qr span{font-size:9px;color:#78716c}
.fsx-note{position:absolute;left:46px;right:46px;bottom:30px;display:flex;justify-content:space-between;gap:12px;font-size:9px;color:#a8a29e}
@media print{
  @page{size:letter;margin:0}
  html,body{background:#fff!important;height:11in!important;max-height:11in!important;overflow:hidden!important;margin:0!important}
  body *{visibility:hidden!important}
  #ohp-factsheet,#ohp-factsheet *{visibility:visible!important}
  .fsx,.fsx-over{position:static!important;background:#fff!important;min-height:0!important;overflow:visible!important}
  .fsx-bar{display:none!important}
  .fsx-stage{padding:0!important;display:block!important}
  .fsx-fit{width:8.5in!important;height:11in!important}
  #ohp-factsheet{position:fixed!important;left:0!important;top:0!important;width:8.5in!important;height:11in!important;transform:none!important;box-shadow:none!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-inside:avoid;page-break-after:avoid}
}
`
