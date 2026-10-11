'use client'

import { useEffect, useRef, useState } from 'react'
import { Expand } from 'lucide-react'
import type { PropertySiteChapter } from './model'

// "Room by room" for both templates: one full-screen panel per room. The room's own photos
// dissolve into one another behind the words (each with a slow zoom), a strip of the room's
// thumbnails sits under the text, and a short room index at the top jumps between rooms.
// tone: 'dark' = Cinematic (black + accent), 'deep' = Editorial (deep green + paper).
export default function RoomChapters({ chapters, onOpen, tone, labelClass = '', numerals }: {
  chapters: PropertySiteChapter[]
  onOpen: (photos: string[], i: number, title: string) => void
  tone: 'dark' | 'deep'
  labelClass?: string
  numerals?: string[]
}) {
  if (!chapters.length) return null
  return (
    <section id="rooms" className={`rc rc-${tone} scroll-mt-16`}>
      <style>{RC_CSS}</style>
      <div className="rc-head">
        <p className={`rc-kicker ${labelClass}`}>Room by room</p>
        <nav className="rc-index" aria-label="Rooms">
          {chapters.map((ch, i) => (
            <a key={ch.id} href={`#room-${ch.id}`} className={labelClass}>
              <b>{numerals?.[i] || String(i + 1).padStart(2, '0')}</b> {ch.label}
            </a>
          ))}
        </nav>
      </div>
      {chapters.map((ch, i) => (
        <Room key={ch.id} ch={ch} n={numerals?.[i] || String(i + 1).padStart(2, '0')} roman={!!numerals} flip={i % 2 === 1} onOpen={onOpen} labelClass={labelClass} />
      ))}
    </section>
  )
}

function Room({ ch, n, roman, flip, onOpen, labelClass }: {
  ch: PropertySiteChapter; n: string; roman: boolean; flip: boolean; labelClass: string
  onOpen: (photos: string[], i: number, title: string) => void
}) {
  const photos = ch.photos.slice(0, 6)
  const [active, setActive] = useState(0)
  const [inView, setInView] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!inView || photos.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setTimeout(() => setActive(a => (a + 1) % photos.length), 5200)
    return () => window.clearTimeout(t)
  }, [inView, active, photos.length])
  const long = (ch.copy || '').length > 220
  return (
    <article ref={ref} id={`room-${ch.id}`} className={`rc-room ${flip ? 'is-flip' : ''} ${inView ? 'is-in' : ''}`}>
      <div className="rc-media">
        {photos.map((src, j) => (
          <img key={src + j} src={src} alt={j === active ? ch.label : ''} loading={j < 2 ? 'lazy' : 'lazy'} className={j === active ? 'is-on' : ''} />
        ))}
      </div>
      <div className="rc-shade" />
      <div className="rc-body">
        {roman
          ? <span className={`rc-chapter ${labelClass}`}>Chapter {n}</span>
          : <span className="rc-num" aria-hidden>{n}</span>}
        <h3 className="sp-display rc-title">{ch.label}</h3>
        {ch.copy && (
          <div className="rc-copy-wrap">
            <p className={`rc-copy ${long && !open ? 'is-clamped' : ''}`}>{ch.copy}</p>
            {long && <button onClick={() => setOpen(o => !o)} className={`rc-more ${labelClass}`}>{open ? 'Less' : 'Read more'}</button>}
          </div>
        )}
        {photos.length > 1 && (
          <div className="rc-strip">
            {photos.map((src, j) => (
              <button key={src + j} onClick={() => setActive(j)} className={j === active ? 'is-on' : ''} aria-label={`Show photo ${j + 1}`}>
                <img src={src} alt="" loading="lazy" />
                {j === active && <i key={active} />}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => onOpen(ch.photos, active, ch.label)} className={`rc-open ${labelClass}`}>
          <Expand className="h-3.5 w-3.5" /> {ch.photos.length} photo{ch.photos.length === 1 ? '' : 's'}
        </button>
      </div>
    </article>
  )
}

const RC_CSS = `
.rc{position:relative}
.rc-dark{background:#0A0A0A;color:#fff}
.rc-deep{background:#0e1d1b;color:#f3efe6}
.rc-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 28px;padding:26px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
@media(min-width:640px){.rc-head{padding:30px 40px}}
.rc-kicker{font-size:10px;letter-spacing:.4em;text-transform:uppercase;color:var(--sp-accent,#C9A24D);font-weight:600}
.rc-index{display:flex;flex-wrap:wrap;gap:6px}
.rc-index a{font-size:11px;letter-spacing:.08em;padding:7px 12px;border:1px solid rgba(255,255,255,.14);border-radius:999px;opacity:.8;transition:opacity .25s,border-color .25s,background .25s}
.rc-index a:hover{opacity:1;border-color:var(--sp-accent,#C9A24D);background:rgba(255,255,255,.05)}
.rc-index b{font-weight:600;color:var(--sp-accent,#C9A24D);margin-right:4px}
.rc-room{position:relative;min-height:88svh;overflow:hidden;display:flex;align-items:flex-end;scroll-margin-top:64px}
@media(min-width:1024px){.rc-room{align-items:center}}
.rc-media{position:absolute;inset:0}
.rc-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.1);transition:opacity 1.4s cubic-bezier(.4,0,.2,1),transform 9s cubic-bezier(.2,.6,.2,1)}
.rc-media img.is-on{opacity:1;transform:scale(1.0)}
.rc-shade{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.88) 0%,rgba(0,0,0,.35) 45%,rgba(0,0,0,.05) 75%)}
@media(min-width:1024px){.rc-shade{background:linear-gradient(90deg,rgba(0,0,0,.86) 0%,rgba(0,0,0,.55) 38%,rgba(0,0,0,0) 70%)}.rc-room.is-flip .rc-shade{background:linear-gradient(270deg,rgba(0,0,0,.86) 0%,rgba(0,0,0,.55) 38%,rgba(0,0,0,0) 70%)}}
.rc-deep .rc-shade{background:linear-gradient(0deg,rgba(9,21,19,.92) 0%,rgba(9,21,19,.4) 45%,rgba(9,21,19,.05) 75%)}
@media(min-width:1024px){.rc-deep .rc-shade{background:linear-gradient(90deg,rgba(9,21,19,.9) 0%,rgba(9,21,19,.55) 38%,rgba(9,21,19,0) 70%)}.rc-deep .rc-room.is-flip .rc-shade{background:linear-gradient(270deg,rgba(9,21,19,.9) 0%,rgba(9,21,19,.55) 38%,rgba(9,21,19,0) 70%)}}
.rc-body{position:relative;z-index:2;width:100%;max-width:560px;padding:40px 20px 36px}
@media(min-width:640px){.rc-body{padding:56px 48px}}
@media(min-width:1024px){.rc-body{margin-left:5vw}.rc-room.is-flip .rc-body{margin-left:auto;margin-right:5vw}}
.rc-num{display:block;font-family:var(--font-cl-display),var(--font-ee-display),Georgia,serif;font-size:clamp(4.5rem,10vw,8.5rem);line-height:.8;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--sp-accent,#C9A24D) 75%,transparent);opacity:0;transform:translateY(30px);transition:opacity .9s ease,transform 1.1s cubic-bezier(.2,.7,.2,1)}
.rc-chapter{display:inline-block;font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:var(--sp-accent,#C9A24D);padding-bottom:10px;border-bottom:1px solid color-mix(in srgb,var(--sp-accent,#C9A24D) 60%,transparent);opacity:0;transform:translateY(30px);transition:opacity .9s ease,transform 1.1s cubic-bezier(.2,.7,.2,1)}
.rc-room.is-in .rc-chapter{opacity:1;transform:none}
.rc-title{margin-top:10px;font-size:clamp(2.4rem,5vw,4.4rem);line-height:.98;letter-spacing:-.02em;font-weight:300;opacity:0;transform:translateY(30px);transition:opacity .9s ease .12s,transform 1.1s cubic-bezier(.2,.7,.2,1) .12s}
.rc-copy-wrap{opacity:0;transform:translateY(24px);transition:opacity .9s ease .24s,transform 1.1s cubic-bezier(.2,.7,.2,1) .24s}
.rc-room.is-in .rc-num,.rc-room.is-in .rc-chapter,.rc-room.is-in .rc-title,.rc-room.is-in .rc-copy-wrap,.rc-room.is-in .rc-strip,.rc-room.is-in .rc-open{opacity:1;transform:none}
.rc-copy{margin-top:18px;font-size:15.5px;line-height:1.8;opacity:.8}
.rc-copy.is-clamped{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.rc-more{margin-top:8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--sp-accent,#C9A24D)}
.rc-strip{display:flex;gap:8px;margin-top:24px;opacity:0;transform:translateY(20px);transition:opacity .9s ease .36s,transform 1.1s cubic-bezier(.2,.7,.2,1) .36s}
.rc-strip button{position:relative;width:64px;aspect-ratio:4/3;overflow:hidden;opacity:.5;transition:opacity .3s,transform .3s;outline:1px solid transparent;outline-offset:2px}
@media(min-width:640px){.rc-strip button{width:78px}}
.rc-strip button:hover{opacity:.85}
.rc-strip button.is-on{opacity:1;outline-color:var(--sp-accent,#C9A24D)}
.rc-strip img{width:100%;height:100%;object-fit:cover}
.rc-strip i{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--sp-accent,#C9A24D);transform-origin:0 50%;animation:rcFill 5.2s linear both}
@keyframes rcFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.rc-open{display:inline-flex;align-items:center;gap:8px;margin-top:22px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;padding:10px 16px;border:1px solid rgba(255,255,255,.3);border-radius:999px;opacity:0;transition:opacity .9s ease .45s,border-color .25s,background .25s}
.rc-deep .rc-open{border-radius:0}
.rc-open:hover{border-color:var(--sp-accent,#C9A24D);background:rgba(255,255,255,.06)}
@media(prefers-reduced-motion:reduce){.rc-media img{transition:opacity .4s ease;transform:none}.rc-num,.rc-title,.rc-copy-wrap,.rc-strip,.rc-open{opacity:1;transform:none;transition:none}.rc-strip i{animation:none}}
`
