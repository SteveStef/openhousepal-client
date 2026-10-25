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
        <Room key={ch.id} ch={ch} n={numerals?.[i] || String(i + 1).padStart(2, '0')} total={String(chapters.length).padStart(2, '0')} roman={!!numerals} flip={i % 2 === 1} onOpen={onOpen} labelClass={labelClass} />
      ))}
    </section>
  )
}

// How long each room photo stays before the next dissolves in (user, 10/24: 30% faster - was 5.2s).
const SLIDE_MS = 3640

function Room({ ch, n, total, roman, flip, onOpen, labelClass }: {
  ch: PropertySiteChapter; n: string; total: string; roman: boolean; flip: boolean; labelClass: string
  onOpen: (photos: string[], i: number, title: string) => void
}) {
  const photos = ch.photos.slice(0, 6)
  const [active, setActive] = useState(0)
  const [inView, setInView] = useState(false)
  const [open, setOpen] = useState(false)
  const [reduced, setReduced] = useState(false)
  const ref = useRef<HTMLElement>(null)
  useEffect(() => { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches) }, [])
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Starts as soon as the room's top reaches the middle of the screen (user, 10/24 - it used to
    // wait until a third of the whole, very tall, room was showing, i.e. nearly centred).
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: '0px 0px -45% 0px', threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const playing = inView && photos.length > 1 && !reduced
  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(() => setActive(a => (a + 1) % photos.length), SLIDE_MS)
    return () => window.clearTimeout(t)
  }, [playing, active, photos.length])
  const long = (ch.copy || '').length > 220
  return (
    <article ref={ref} id={`room-${ch.id}`} className={`rc-room ${flip ? 'is-flip' : ''} ${inView ? 'is-in' : ''}`}>
      {/* Desktop: the photos fill the panel behind the words. Phones (user, 10/18 - the words sat too
          high and covered the photo, the number was hard to see): the photo gets its own tall panel
          with a solid room number and the room's name on it, and the words come after it. */}
      <div className="rc-photo">
        <div className="rc-media">
          {photos.map((src, j) => (
            <img key={src + j} src={src} alt={j === active ? ch.label : ''} loading="lazy" className={j === active ? 'is-on' : ''} />
          ))}
        </div>
        <div className="rc-shade" />
        <button type="button" className="rc-tap" onClick={() => onOpen(ch.photos, active, ch.label)} aria-label={`See all ${ch.label} photos`} />
        <span className={`rc-badge ${labelClass}`}>{roman ? <>Chapter {n}</> : <>{n}<i>/ {total}</i></>}</span>
        <h3 className="sp-display rc-title-m">{ch.label}</h3>
        {/* A thin line along the photo's bottom edge that fills until the next photo comes in. */}
        {photos.length > 1 && !reduced && (
          <span className="rc-bar" aria-hidden>
            <i key={`${active}-${playing}`} style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: playing ? 'running' : 'paused' }} />
          </span>
        )}
      </div>
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
                {j === active && <i key={`${active}-${playing}`} style={{ animationPlayState: playing ? 'running' : 'paused' }} />}
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
/* Phones + tablets: no room shortcuts row (user, 10/24) - the rooms simply follow one another. */
@media(max-width:1023px){.rc-index{display:none}}
.rc-room{position:relative;overflow:hidden;scroll-margin-top:64px}
/* overflow:hidden - the slowly zooming photos are scaled past the panel; unclipped, a strip of
   un-shaded photo showed below the room's name (user, 10/24). */
.rc-photo{position:relative;height:74svh;min-height:400px;max-height:760px;overflow:hidden}
.rc-bar{position:absolute;left:0;right:0;bottom:0;z-index:3;height:2px;background:rgba(255,255,255,.16);pointer-events:none}
.rc-bar i{display:block;height:100%;width:100%;background:var(--sp-accent,#C9A24D);transform-origin:0 50%;animation-name:rcFill;animation-timing-function:linear;animation-fill-mode:both;box-shadow:0 0 8px color-mix(in srgb,var(--sp-accent,#C9A24D) 70%,transparent)}
.rc-media{position:absolute;inset:0}
.rc-tap{position:absolute;inset:0;z-index:1}
.rc-badge{position:absolute;left:16px;top:16px;z-index:2;display:inline-flex;align-items:baseline;gap:5px;padding:7px 12px;border-radius:999px;background:var(--sp-accent,#C9A24D);color:var(--sp-on-accent,#111);font-size:13px;font-weight:700;letter-spacing:.06em;box-shadow:0 8px 22px -8px rgba(0,0,0,.6)}
.rc-badge i{font-style:normal;font-size:11px;opacity:.7}
.rc-deep .rc-badge{border-radius:0}
.rc-title-m{position:absolute;left:20px;right:20px;bottom:18px;z-index:2;font-size:clamp(2.1rem,9vw,3rem);line-height:1;letter-spacing:-.02em;font-weight:300;text-shadow:0 2px 18px rgba(0,0,0,.45);pointer-events:none}
.rc-room .rc-num,.rc-room .rc-chapter,.rc-room .rc-title{display:none}
@media(min-width:1024px){
  .rc-room{min-height:88svh;display:flex;align-items:center}
  .rc-photo{position:absolute;inset:0;height:auto;min-height:0;max-height:none}
  .rc-tap,.rc-badge,.rc-title-m{display:none}
  .rc-room .rc-num,.rc-room .rc-title{display:block}
  .rc-room .rc-chapter{display:inline-block}
}
.rc-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.1);transition:opacity 1.2s cubic-bezier(.4,0,.2,1),transform 6.3s cubic-bezier(.2,.6,.2,1)}
.rc-media img.is-on{opacity:1;transform:scale(1.0)}
/* Phones: the shade runs into the page's own colour at the very bottom, so the photo melts into the
   words below it with no hard edge or bright line. */
.rc-shade{position:absolute;inset:-1px 0;background:linear-gradient(0deg,#0A0A0A 0%,rgba(10,10,10,.78) 12%,rgba(0,0,0,.3) 34%,rgba(0,0,0,0) 55%),linear-gradient(180deg,rgba(0,0,0,.25) 0%,rgba(0,0,0,0) 22%)}
@media(min-width:1024px){.rc-shade{background:linear-gradient(90deg,rgba(0,0,0,.86) 0%,rgba(0,0,0,.55) 38%,rgba(0,0,0,0) 70%)}.rc-room.is-flip .rc-shade{background:linear-gradient(270deg,rgba(0,0,0,.86) 0%,rgba(0,0,0,.55) 38%,rgba(0,0,0,0) 70%)}}
.rc-deep .rc-shade{background:linear-gradient(0deg,#0e1d1b 0%,rgba(14,29,27,.8) 12%,rgba(9,21,19,.32) 34%,rgba(9,21,19,0) 55%),linear-gradient(180deg,rgba(9,21,19,.25) 0%,rgba(9,21,19,0) 22%)}
@media(min-width:1024px){.rc-deep .rc-shade{background:linear-gradient(90deg,rgba(9,21,19,.9) 0%,rgba(9,21,19,.55) 38%,rgba(9,21,19,0) 70%)}.rc-deep .rc-room.is-flip .rc-shade{background:linear-gradient(270deg,rgba(9,21,19,.9) 0%,rgba(9,21,19,.55) 38%,rgba(9,21,19,0) 70%)}}
.rc-body{position:relative;z-index:2;width:100%;max-width:560px;padding:4px 20px 40px}
.rc-body>.rc-copy-wrap .rc-copy{margin-top:16px}
@media(min-width:640px){.rc-body{padding:8px 40px 48px}}
@media(min-width:1024px){.rc-body{padding:56px 48px}}
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
.rc-strip{display:flex;gap:8px;margin-top:20px;overflow-x:auto;scrollbar-width:none;padding:3px;margin-left:-3px;opacity:0;transform:translateY(20px);transition:opacity .9s ease .36s,transform 1.1s cubic-bezier(.2,.7,.2,1) .36s}
.rc-strip button{position:relative;width:64px;aspect-ratio:4/3;overflow:hidden;opacity:.5;transition:opacity .3s,transform .3s;outline:1px solid transparent;outline-offset:2px}
@media(min-width:640px){.rc-strip button{width:78px}}
.rc-strip button:hover{opacity:.85}
.rc-strip button.is-on{opacity:1;outline-color:var(--sp-accent,#C9A24D)}
.rc-strip img{width:100%;height:100%;object-fit:cover}
.rc-strip i{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--sp-accent,#C9A24D);transform-origin:0 50%;animation:rcFill ${SLIDE_MS}ms linear both}
@keyframes rcFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.rc-open{display:inline-flex;align-items:center;gap:8px;margin-top:22px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;padding:10px 16px;border:1px solid rgba(255,255,255,.3);border-radius:999px;opacity:0;transition:opacity .9s ease .45s,border-color .25s,background .25s}
.rc-deep .rc-open{border-radius:0}
.rc-open:hover{border-color:var(--sp-accent,#C9A24D);background:rgba(255,255,255,.06)}
@media(prefers-reduced-motion:reduce){.rc-media img{transition:opacity .4s ease;transform:none}.rc-num,.rc-title,.rc-copy-wrap,.rc-strip,.rc-open{opacity:1;transform:none;transition:none}.rc-strip i,.rc-bar i{animation:none}}
`
