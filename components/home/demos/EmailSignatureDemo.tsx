'use client'

import { useEffect, useRef, useState } from 'react'
import { Mail, Home, IdCard, MousePointerClick, BarChart3, Send } from 'lucide-react'
import { DemoStep, DEMO_NOTE_CSS } from './DemoNote'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import { buildDesignPreviewHtml } from '@/lib/signaturePreview'
import { buildSignatureSiteInput } from '@/lib/signatureSiteData'
import { PETER_SIGNATURE } from './signatureSnapshot'

// Peter's own signature, exactly as he set it up in Studio (frozen in signatureSnapshot.ts, so it
// never changes): rendered by the same buildSignatureSiteInput + buildDesignPreviewHtml the Studio
// Live Preview uses. Nothing gets edited here - a strip along the top names one part at a time and
// that part gets a gold outline inside the card.
// Rendered at its real width (720px, same as Studio) and shrunk with CSS zoom (stays crisp).
const NATIVE_W = 720
const SCALE = 0.86

const SNAP = PETER_SIGNATURE as any
function buildSrcDoc(): string {
  const input = buildSignatureSiteInput({ config: SNAP.config, hubConfig: SNAP.hub, agentHubSlug: SNAP.slug, forms: SNAP.forms })
  return buildDesignPreviewHtml({ ...input, interactive: true }).replace('</body>', `${HL_SCRIPT}</body>`)
}

// Outlines one part of the card when the parent asks (by CSS selector); '' clears it.
const HL_SCRIPT = `<style>@keyframes demoHl{0%,100%{outline-color:#C9A24D;box-shadow:0 0 0 7px rgba(201,162,77,.35),0 0 26px 6px rgba(201,162,77,.45)}50%{outline-color:#E8C97A;box-shadow:0 0 0 11px rgba(201,162,77,.18),0 0 34px 10px rgba(201,162,77,.3)}}.demo-hl{position:relative;z-index:5;outline:3px solid #C9A24D!important;outline-offset:3px;border-radius:12px;animation:demoHl 1.4s ease-in-out infinite!important}.gallery-rail.demo-hl{outline-offset:-5px}</style><script>(function(){window.addEventListener('message',function(e){var d=e&&e.data;if(!d||d.type!=='sig-hl')return;document.querySelectorAll('.demo-hl').forEach(function(n){n.classList.remove('demo-hl')});if(d.sel){document.querySelectorAll(d.sel).forEach(function(n){n.classList.add('demo-hl')})}});})();</script>`

const STEPS = [
  { at: 0, icon: Mail, title: 'Your signature', body: 'At the bottom of every email.', sel: '' },
  { at: 3600, icon: Home, title: 'Your listing & sales', body: 'They rotate in on their own.', sel: '.rot-wrap, .gallery-listing-wrap, .mini-bubble' },
  { at: 8400, icon: IdCard, title: 'Save Contact', body: 'One tap - you’re in their phone.', sel: '.portrait-frame' },
  { at: 11800, icon: MousePointerClick, title: 'Buttons bring leads', body: 'Each one opens your form.', sel: '.gallery-action' },
  { at: 15200, icon: BarChart3, title: 'Your numbers', body: 'From your real sales.', sel: '.gallery-rail' },
  { at: 18600, icon: Send, title: 'Paste once. Done.', body: 'It keeps itself up to date.', sel: '' },
]
const TITLE_DURATION = 5200
const CARD_DURATION = 23000
const CLIENTS = ['Gmail', 'Outlook', 'Apple Mail']

type Beat = { k: 'title-slide' } | { k: 'card' }
const BEATS: Beat[] = [{ k: 'title-slide' }, { k: 'card' }]

export default function EmailSignatureDemo() {
  const [i, setI] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [frameHeight, setFrameHeight] = useState(260)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Fits the card to the stage on narrow screens (phones) - never bigger than SCALE.
  const stageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(SCALE)
  const [srcDoc] = useState(buildSrcDoc)
  const beat = BEATS[i]

  useEffect(() => {
    const t = setTimeout(() => setI(n => (n + 1) % BEATS.length), beat.k === 'title-slide' ? TITLE_DURATION : CARD_DURATION)
    setElapsed(0)
    const start = Date.now()
    const tick = setInterval(() => setElapsed(Date.now() - start), 250)
    return () => { clearTimeout(t); clearInterval(tick) }
  }, [i, beat])

  // The card reports its real height (signaturePreview.ts's ResizeObserver), same as Studio.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'signature-preview-height' && typeof e.data.height === 'number') setFrameHeight(Math.ceil(e.data.height))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const fit = () => setScale(Math.min(SCALE, (el.clientWidth - 16) / NATIVE_W))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [beat.k])

  const stepIdx = Math.max(0, STEPS.findIndex((s, k) => elapsed >= s.at && (k === STEPS.length - 1 || elapsed < STEPS[k + 1].at)))
  const step = STEPS[stepIdx]
  useEffect(() => {
    if (beat.k !== 'card') return
    iframeRef.current?.contentWindow?.postMessage({ type: 'sig-hl', sel: step.sel }, '*')
  }, [beat.k, step.sel])

  if (beat.k === 'title-slide') {
    return (
      <TitleSlide
        icon={Mail}
        iconClassName="ohp-icon-assemble-mail"
        kicker="Brand"
        title="Signature"
        body="Your brand in every email - it updates itself."
        nowrapBody
        durationMs={TITLE_DURATION}
        totalPages={2}
        pageIndex={0}
        url="app.openhousepal.com/studio/email-signature"
      />
    )
  }

  const lastStep = stepIdx === STEPS.length - 1
  return (
    <BrowserFrame url="app.openhousepal.com/studio/email-signature" progress={{ pages: 2, current: 1, durationMs: CARD_DURATION }}>
      <style>{DEMO_NOTE_CSS}</style>
      <div ref={stageRef} className="relative flex h-[420px] flex-col items-center justify-center gap-4 overflow-hidden bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.16),transparent_60%),linear-gradient(140deg,#fffdf8,#f6efe0)] px-3 pt-14 dark:bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.14),transparent_60%),linear-gradient(140deg,#0b0f0e,#141210)]">
        <DemoStep id={String(stepIdx)} step={stepIdx + 1} count={STEPS.length} title={step.title} body={step.body} icon={step.icon} />
        <iframe
          ref={iframeRef}
          title="Email signature"
          srcDoc={srcDoc}
          onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: 'sig-hl', sel: step.sel }, '*')}
          style={{ width: NATIVE_W, height: frameHeight, colorScheme: 'light', ...({ zoom: scale } as React.CSSProperties) }}
          className="max-w-none shrink-0 border-0 bg-transparent"
          sandbox="allow-scripts"
        />
        <div className={`flex items-center gap-2 transition-all duration-500 ${lastStep ? 'scale-105 opacity-100' : 'opacity-60'}`}>
          {CLIENTS.map((c, k) => (
            <span key={c} className={`dn-hl inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-[11px] font-black text-[#111827] shadow-sm dark:bg-[#151517] dark:text-white ${lastStep ? 'dn-on border-[#C9A24D]/50' : 'border-[#e7ddcf] dark:border-gray-800'}`} style={{ transitionDelay: `${k * 120}ms` }}>
              <Mail className="h-3.5 w-3.5 text-[#C9A24D]" />{c}
            </span>
          ))}
        </div>
      </div>
    </BrowserFrame>
  )
}
