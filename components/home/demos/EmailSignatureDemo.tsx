'use client'

import { useEffect, useRef, useState } from 'react'
import { Mail, Home, IdCard, MousePointerClick, BarChart3, Send, Search } from 'lucide-react'
import { DemoStep, DEMO_NOTE_CSS } from './DemoNote'
import BrowserFrame from '@/components/home/BrowserFrame'
import TitleSlide from './TitleSlide'
import usePhoneLayout from './usePhoneLayout'
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

// Outlines one part of the card when the parent asks (by CSS selector); '' clears it. It also
// reports where that part sits in the card (sig-hl-rect) - only the phone camera below uses it.
const HL_SCRIPT = `<style>@keyframes demoHl{0%,100%{outline-color:#C9A24D;box-shadow:0 0 0 7px rgba(201,162,77,.35),0 0 26px 6px rgba(201,162,77,.45)}50%{outline-color:#E8C97A;box-shadow:0 0 0 11px rgba(201,162,77,.18),0 0 34px 10px rgba(201,162,77,.3)}}.demo-hl{position:relative;z-index:5;outline:3px solid #C9A24D!important;outline-offset:3px;border-radius:12px;animation:demoHl 1.4s ease-in-out infinite!important}.gallery-rail.demo-hl{outline-offset:-5px}</style><script>(function(){window.addEventListener('message',function(e){var d=e&&e.data;if(!d||d.type!=='sig-hl')return;document.querySelectorAll('.demo-hl').forEach(function(n){n.classList.remove('demo-hl')});var r=null;if(d.sel){document.querySelectorAll(d.sel).forEach(function(n){n.classList.add('demo-hl');var b=n.getBoundingClientRect();if(b.width<2||b.height<2)return;r=r?{l:Math.min(r.l,b.left),t:Math.min(r.t,b.top),r:Math.max(r.r,b.right),b:Math.max(r.b,b.bottom)}:{l:b.left,t:b.top,r:b.right,b:b.bottom}})}try{window.parent.postMessage({type:'sig-hl-rect',sel:d.sel||'',rect:r?{x:r.l,y:r.t,w:r.r-r.l,h:r.b-r.t}:null},'*')}catch(_){}});})();</script>`

// Phones: the whole 720px card shrinks to ~45% there - too small to read on its own. So on a phone
// the whole card stays on screen (scaled to fit, the step's part ringed in gold just like desktop)
// and a "magnifier" card underneath shows only that part, enlarged and readable - always the whole
// part, with soft faded edges around it, never words sliced at an edge. Desktop never uses this.
const PHONE_AREA_H = 286
const MAG_PAD = 24 // room around the magnified part: its gold ring + glow, then the soft fade
const MAG_MAX = 1.1
const MAG_GLOW = 9 // kept fully visible around the part (the gold ring sits here)
const MAG_FEATHER = 13 // then everything else fades out to the card's white over this many px
type Rect = { x: number; y: number; w: number; h: number }

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
  // Phone layout (see PHONE_AREA_H above): the area's width, where the outlined part is, and the
  // second copy of the card that the magnifier shows.
  const phone = usePhoneLayout()
  const areaRef = useRef<HTMLDivElement>(null)
  const magRef = useRef<HTMLIFrameElement>(null)
  const [areaW, setAreaW] = useState(0)
  const [focus, setFocus] = useState<{ sel: string; rect: Rect | null }>({ sel: '', rect: null })
  // What the magnifier shows. It only changes while the magnifier is faded out, so it never pans
  // across other parts of the card on screen.
  const [magView, setMagView] = useState<Rect | null>(null)
  const [magVisible, setMagVisible] = useState(false)

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
      if (e.data && e.data.type === 'sig-hl-rect' && e.source === iframeRef.current?.contentWindow) {
        setFocus({ sel: String(e.data.sel || ''), rect: e.data.rect || null })
      }
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

  useEffect(() => {
    const el = areaRef.current
    if (!phone || !el) return
    const measure = () => setAreaW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [phone, beat.k])

  const stepIdx = Math.max(0, STEPS.findIndex((s, k) => elapsed >= s.at && (k === STEPS.length - 1 || elapsed < STEPS[k + 1].at)))
  const step = STEPS[stepIdx]
  useEffect(() => {
    if (beat.k !== 'card') return
    iframeRef.current?.contentWindow?.postMessage({ type: 'sig-hl', sel: step.sel }, '*')
    magRef.current?.contentWindow?.postMessage({ type: 'sig-hl', sel: step.sel }, '*')
  }, [beat.k, step.sel, phone])

  // Phones: fade the magnifier out, swap to the new part while it's hidden, then fade back in.
  const target = beat.k === 'card' && step.sel && focus.sel === step.sel ? focus.rect : null
  useEffect(() => {
    if (!phone) return
    setMagVisible(false)
    if (!target) return
    const t = setTimeout(() => { setMagView(target); setMagVisible(true) }, 380)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, target?.x, target?.y, target?.w, target?.h])

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

  // Phone layout. Wide parts (listing, buttons): the whole card across the top, the magnifier
  // below it. Tall parts (the stats rail): the whole card smaller on the left, a tall magnifier on
  // the right - so the part can be shown bigger than it is in the card. Either way the magnifier
  // fits the WHOLE part inside its padding, so nothing in it is ever cut.
  type Box = { x: number; y: number; w: number; h: number }
  let ph: { s: number; cardX: number; cardY: number; box: Box; m: number; mx: number; my: number; mask: string } | null = null
  const tall = (r: Rect | null) => !!r && r.h > r.w * 1.4
  if (phone && areaW > 0) {
    const fitW = Math.min(SCALE, (areaW - 4) / NATIVE_W)
    const layoutBox = (r: Rect | null): { s: number; box: Box } => {
      if (tall(r)) {
        const w = Math.round(Math.min(areaW * 0.42, r!.w * MAG_MAX + 2 * MAG_PAD))
        return { s: (areaW - w - 10) / NATIVE_W, box: { x: areaW - w, y: 0, w, h: PHONE_AREA_H } }
      }
      const top = Math.round(frameHeight * fitW + 12)
      return { s: fitW, box: { x: 0, y: top, w: areaW, h: Math.max(110, PHONE_AREA_H - top) } }
    }
    // the card follows the part being explained right now; the magnifier box keeps the shape of
    // what it is showing (it only changes while faded out)
    const now = target ?? (magVisible ? magView : null)
    const card = layoutBox(now)
    const cardW = NATIVE_W * card.s
    const cardH = frameHeight * card.s
    const cardX = tall(now) ? 0 : (areaW - cardW) / 2
    const cardY = now ? (tall(now) ? (PHONE_AREA_H - cardH) / 2 : 0) : (PHONE_AREA_H - cardH) / 2
    const { box } = layoutBox(magView)
    let m = 1, mx = 0, my = 0, mask = 'none'
    const r = magView
    if (r) {
      m = Math.min(MAG_MAX, (box.w - 2 * MAG_PAD) / r.w, (box.h - 2 * MAG_PAD) / r.h)
      mx = box.w / 2 - (r.x + r.w / 2) * m
      my = box.h / 2 - (r.y + r.h / 2) * m
      // Only the part itself (plus its gold ring) stays; its neighbours fade away, so nothing
      // around it shows up half-cut.
      const L = mx + r.x * m - MAG_GLOW, T = my + r.y * m - MAG_GLOW, R = mx + (r.x + r.w) * m + MAG_GLOW, B = my + (r.y + r.h) * m + MAG_GLOW
      mask = `linear-gradient(to right, transparent ${L - MAG_FEATHER}px, #000 ${L}px, #000 ${R}px, transparent ${R + MAG_FEATHER}px), linear-gradient(to bottom, transparent ${T - MAG_FEATHER}px, #000 ${T}px, #000 ${B}px, transparent ${B + MAG_FEATHER}px)`
    }
    ph = { s: card.s, cardX, cardY, box, m, mx, my, mask }
  }
  const onCardLoad = (ref: React.RefObject<HTMLIFrameElement | null>) => () => ref.current?.contentWindow?.postMessage({ type: 'sig-hl', sel: step.sel }, '*')

  return (
    <BrowserFrame url="app.openhousepal.com/studio/email-signature" progress={{ pages: 2, current: 1, durationMs: CARD_DURATION }}>
      <style>{DEMO_NOTE_CSS}</style>
      <div ref={stageRef} className="relative flex h-[420px] flex-col items-center justify-center gap-4 overflow-hidden bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.16),transparent_60%),linear-gradient(140deg,#fffdf8,#f6efe0)] px-3 pt-14 dark:bg-[radial-gradient(90%_80%_at_80%_10%,rgba(201,162,77,.14),transparent_60%),linear-gradient(140deg,#0b0f0e,#141210)]">
        <DemoStep id={String(stepIdx)} step={stepIdx + 1} count={STEPS.length} title={step.title} body={step.body} icon={step.icon} />
        {phone ? (
          <div ref={areaRef} className="relative w-full shrink-0 transition-opacity duration-300" style={{ height: PHONE_AREA_H, opacity: ph ? 1 : 0 }}>
            {/* the whole card, scaled to fit - its gold ring shows which part is being explained */}
            <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${ph?.cardX ?? 0}px, ${ph?.cardY ?? 0}px) scale(${ph?.s ?? 0.4})`, transition: 'transform .8s cubic-bezier(.22,.61,.36,1)' }}>
              <iframe
                ref={iframeRef}
                title="Email signature"
                srcDoc={srcDoc}
                onLoad={onCardLoad(iframeRef)}
                style={{ width: NATIVE_W, height: frameHeight, colorScheme: 'light' }}
                className="block max-w-none border-0 bg-transparent"
                sandbox="allow-scripts"
              />
            </div>
            {/* the magnifier: just the outlined part, enlarged, faded softly at its edges */}
            <div
              aria-hidden
              className="pointer-events-none absolute overflow-hidden rounded-2xl bg-white shadow-[0_18px_40px_-18px_rgba(0,0,0,.45)] ring-1 ring-[#C9A24D]/35 dark:bg-[#151517]"
              style={{ left: ph?.box.x ?? 0, top: ph?.box.y ?? 0, width: ph?.box.w ?? 0, height: ph?.box.h ?? 0, opacity: magVisible ? 1 : 0, transform: magVisible ? 'none' : 'translateY(8px) scale(.98)', transition: 'opacity .35s ease, transform .35s cubic-bezier(.22,.61,.36,1)' }}
            >
              <div className="absolute inset-0" style={{ WebkitMaskImage: ph?.mask, maskImage: ph?.mask, WebkitMaskComposite: 'source-in', maskComposite: 'intersect' } as React.CSSProperties}>
                <iframe
                  ref={magRef}
                  title="Email signature, close up"
                  tabIndex={-1}
                  srcDoc={srcDoc}
                  onLoad={onCardLoad(magRef)}
                  style={{ position: 'absolute', left: 0, top: 0, width: NATIVE_W, height: frameHeight, colorScheme: 'light', transformOrigin: '0 0', transform: `translate(${ph?.mx ?? 0}px, ${ph?.my ?? 0}px) scale(${ph?.m ?? 1})` }}
                  className="max-w-none border-0 bg-transparent"
                  sandbox="allow-scripts"
                />
              </div>
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#111827]/90 px-2 py-0.5 text-[9px] font-black text-[#f3dfa8] shadow"><Search className="h-2.5 w-2.5" /> Up close</span>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            title="Email signature"
            srcDoc={srcDoc}
            onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: 'sig-hl', sel: step.sel }, '*')}
            style={{ width: NATIVE_W, height: frameHeight, colorScheme: 'light', ...({ zoom: scale } as React.CSSProperties) }}
            className="max-w-none shrink-0 border-0 bg-transparent"
            sandbox="allow-scripts"
          />
        )}
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
