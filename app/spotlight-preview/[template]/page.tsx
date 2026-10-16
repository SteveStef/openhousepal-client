'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import CinematicLuxuryTemplate from '@/components/property-sites/CinematicLuxuryTemplate'
import EditorialEstateTemplate from '@/components/property-sites/EditorialEstateTemplate'
import type { HeaderMode, HeaderMotion, PropertySiteResolveResponse } from '@/components/property-sites/spotlight/model'
import { SPOTLIGHT_PREVIEW_SAMPLE } from '@/lib/spotlightPreviewSample'
import api from '@/lib/api-service'

// The Spotlight editor's preview: either design with the finished sample home, or - with
// ?site=<id> - the agent's own unpublished draft rendered exactly like the live page.
//   ?mode= / ?motion= / ?video= / ?poster=  try a header style without saving it
//   ?demo=ridgeview                         the living-photo example (Peter's 5829 Ridgeview sale)
//   ?embed=1                                shown small inside the editor (no scrollbar)
// Inside the editor it also listens for {type:'ohp-preview', visibility, scrollTo} messages so the
// Sections step can hide/show sections live and glide to the one being changed.
const RIDGEVIEW: Partial<PropertySiteResolveResponse['property']> = {
  address: '5829 Ridgeview Dr', city: 'Doylestown', state: 'PA', zipcode: '18902', status: 'CLOSED',
  price: 1900000, beds: 4, baths: 5.5, sqft: 6124, lot_size_acres: 2.01,
  photos: ['/demos/spotlight/header-photo.jpg'],
}

function Preview() {
  const { template } = useParams<{ template: string }>()
  const search = useSearchParams()
  const siteId = search.get('site')
  const [data, setData] = useState<PropertySiteResolveResponse | null>(siteId ? null : SPOTLIGHT_PREVIEW_SAMPLE)
  const [failed, setFailed] = useState(false)
  const [visibility, setVisibility] = useState<Record<string, boolean> | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!siteId) { setData(SPOTLIGHT_PREVIEW_SAMPLE); return }
    api.propertySites.preview(siteId).then(({ success, data: d }) => {
      if (success && d) setData(d as PropertySiteResolveResponse)
      else setFailed(true)
    })
  }, [siteId])

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'ohp-preview') return
      if (e.data.visibility) setVisibility(e.data.visibility)
      if (e.data.scrollTo) {
        const el = document.getElementById(e.data.scrollTo)
        if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 110, behavior: 'smooth' })
      }
      // Sections step: one switch flipped - played in order, one change at a time.
      if (e.data.change?.id) {
        const c = e.data.change as { id: string; show: boolean; visibility: Record<string, boolean> }
        queue.current = queue.current.then(() => playChange(c, setVisibility)).catch(() => setVisibility(c.visibility))
      }
    }
    window.addEventListener('message', onMsg)
    window.parent?.postMessage({ type: 'ohp-preview-ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  const embed = search.get('embed') === '1'
  useEffect(() => {
    if (!embed) return
    document.documentElement.style.scrollbarWidth = 'none'
    const st = document.createElement('style')
    st.textContent = 'html::-webkit-scrollbar{display:none}nextjs-portal{display:none}' + HIGHLIGHT_CSS
    document.head.appendChild(st)
    return () => { st.remove() }
  }, [embed])

  const shown = useMemo(() => {
    if (!data) return null
    const demo = search.get('demo') === 'ridgeview'
    const mode = (demo ? 'video' : search.get('mode')) as HeaderMode | null
    const motion = search.get('motion') as HeaderMotion | null
    const video = demo ? '/demos/spotlight/header-loop.mp4' : search.get('video')
    const poster = demo ? '/demos/spotlight/header-photo.jpg' : search.get('poster')
    const header = {
      ...(data.content.header || {}),
      ...(mode ? { mode } : {}),
      ...(motion ? { motion } : {}),
      ...(video ? { video: { url: video, poster } } : {}),
      // ?fx=&fy=&fz= - try a framing of the main photo without saving it
      ...(search.get('fx') ? { frame: { x: Number(search.get('fx')), y: Number(search.get('fy') || 50), zoom: Number(search.get('fz') || 1.12),
        ...(search.get('fpx') ? { px: Number(search.get('fpx')), py: Number(search.get('fpy') || 50) } : {}) } } : {}),
    }
    return {
      ...data,
      template_id: template,
      property: demo ? { ...data.property, ...RIDGEVIEW } as PropertySiteResolveResponse['property'] : data.property,
      content: {
        ...data.content,
        ...(demo ? { hero_image: '/demos/spotlight/header-photo.jpg', open_houses: [] } : {}),
        ...(!demo && search.get('hero') ? { hero_image: search.get('hero') } : {}),
        header,
        // A preview never calls Google Places (Explore Nearby) - it's a real-visitor feature.
        section_visibility: { ...(data.content.section_visibility || {}), ...(visibility || {}), explore_nearby: false },
      },
    }
  }, [data, template, search, visibility])

  if (failed) return <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A] text-sm font-bold text-white/60">Couldn&apos;t load your page preview - sign in and try again.</div>
  if (!shown) return <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  // The agent's real page address (sent with the draft), so QR codes and share links in the
  // preview open the actual Spotlight page; the sample pages fall back to a placeholder.
  const url = (shown as { public_url?: string }).public_url || 'https://preview.openhousepal.com'
  return template === 'editorial_estate'
    ? <EditorialEstateTemplate data={shown} publicUrl={url} />
    : <CinematicLuxuryTemplate data={shown} publicUrl={url} />
}

const wait = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))
const frames = (n: number) => new Promise<void>(r => { const step = (k: number) => (k <= 0 ? r() : requestAnimationFrame(() => step(k - 1))); step(n) })

// Bring a section into view, then wait until the page has stopped moving. A long jump goes there
// instantly (a smooth scroll down a long page took ages); a short one glides.
async function scrollToSection(el: HTMLElement) {
  const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - 110)
  const far = Math.abs(top - window.scrollY) > 2200
  window.scrollTo({ top, behavior: far ? 'auto' : 'smooth' })
  let last = -1, still = 0
  for (let i = 0; i < 60 && still < 4; i++) {
    await wait(40)
    if (Math.abs(window.scrollY - last) < 1) still++
    else { still = 0; last = window.scrollY }
  }
}

// Removing: scroll there, outline it red, then fold it shut so everything below glides up, and only
// then take it out. Adding: put it in folded shut, scroll there, open it up so the page below
// glides down, then glow gold.
async function playChange(c: { id: string; show: boolean; visibility: Record<string, boolean> }, apply: (v: Record<string, boolean>) => void) {
  const ease = 'cubic-bezier(.65,0,.35,1)'
  if (!c.show) {
    const el = document.getElementById(c.id)
    if (!el) { apply(c.visibility); return }
    await scrollToSection(el)
    el.classList.add('ohp-hl-out')
    await wait(1000)
    el.style.height = `${el.offsetHeight}px`
    el.style.overflow = 'hidden'
    void el.offsetHeight
    el.style.transition = `height .75s ${ease}, opacity .5s ease, transform .75s ${ease}`
    el.style.height = '0px'
    el.style.opacity = '0'
    el.style.transform = 'scale(.97)'
    await wait(780)
    apply(c.visibility)
    return
  }
  const fold = document.createElement('style')
  fold.textContent = `[id="${c.id}"]{height:0!important;overflow:hidden!important;opacity:0!important}`
  document.head.appendChild(fold)
  apply(c.visibility)
  await frames(2)
  const el = document.getElementById(c.id)
  if (!el) { fold.remove(); return }
  await scrollToSection(el)
  el.style.height = '0px'
  el.style.overflow = 'hidden'
  el.style.opacity = '0'
  fold.remove()
  const target = el.scrollHeight
  void el.offsetHeight
  el.style.transition = `height .85s ${ease}, opacity .6s ease .2s`
  el.style.height = `${target}px`
  el.style.opacity = '1'
  await wait(880)
  el.style.height = ''
  el.style.overflow = ''
  el.style.opacity = ''
  el.style.transition = ''
  el.classList.remove('ohp-hl-in')
  void el.offsetWidth
  el.classList.add('ohp-hl-in')
  window.setTimeout(() => el.classList.remove('ohp-hl-in'), 3100)
}

// The preview is shown shrunk (~40%), so the outline and its tag are drawn big.
const HIGHLIGHT_CSS = `
.ohp-hl-in,.ohp-hl-out{position:relative}
.ohp-hl-in::after,.ohp-hl-out::after{content:"";position:absolute;inset:10px;border-radius:22px;pointer-events:none;z-index:60}
.ohp-hl-in::after{border:5px solid #C9A24D;box-shadow:0 0 0 10px rgba(201,162,77,.18),0 0 90px rgba(201,162,77,.6),inset 0 0 70px rgba(201,162,77,.25);animation:ohpGlow 3s ease both}
.ohp-hl-out::after{border:5px solid #ef4444;box-shadow:0 0 0 10px rgba(239,68,68,.15),0 0 90px rgba(239,68,68,.5),inset 0 0 70px rgba(239,68,68,.2);animation:ohpGlowOut 1.7s ease both}
.ohp-hl-in::before,.ohp-hl-out::before{position:absolute;top:44px;left:50%;z-index:61;padding:14px 30px;border-radius:999px;font:800 26px/1 system-ui,sans-serif;letter-spacing:.02em;white-space:nowrap;pointer-events:none;transform:translateX(-50%)}
.ohp-hl-in::before{content:"✓  Added to your page";background:#C9A24D;color:#111827;animation:ohpTag 3s ease both}
.ohp-hl-out::before{content:"Removing from your page";background:#ef4444;color:#fff;animation:ohpTag 1.7s ease both}
@keyframes ohpHlIn{from{opacity:0;transform:translateY(60px) scale(.98);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes ohpHlOut{to{opacity:0;transform:scale(.96);filter:blur(4px) grayscale(1)}}
@keyframes ohpGlow{0%{opacity:0}12%{opacity:1}30%{opacity:.5}48%{opacity:1}75%{opacity:1}100%{opacity:0}}
@keyframes ohpGlowOut{0%{opacity:0}20%{opacity:1}40%{opacity:.6}60%{opacity:1}100%{opacity:1}}
@keyframes ohpTag{0%{opacity:0;transform:translate(-50%,-14px)}12%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-8px)}}
`

export default function SpotlightPreviewPage() {
  return <Suspense fallback={null}><Preview /></Suspense>
}
