'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { ArrowRight, Compass, Heart, MapPin, Sparkles, Store, TrainFront, Trees } from 'lucide-react'

// "Life in <town>" for both Spotlight templates - short, scannable facts (the downtown and what's
// there, what the town is known for, why people choose it, getting around, the outdoors, what's
// new) each with its own small graphic, instead of paragraphs. Everything animates in once as it
// scrolls into view; under reduced motion it's simply shown.
export interface TownFacts {
  tagline?: string
  known_for?: string[]
  downtown?: { name?: string; where?: string; highlights?: string[] }
  why_move?: string[]
  getting_around?: { label: string; detail?: string }[]
  outdoors?: string[]
  whats_new?: string
}

export function hasTownFacts(f?: TownFacts | null): boolean {
  if (!f) return false
  return !!(f.tagline || f.known_for?.length || f.downtown?.name || f.why_move?.length || f.getting_around?.length || f.outdoors?.length)
}

export default function TownSection({ name, facts, body, place, kicker, tone, photo, onExplore }: {
  name: string
  facts?: TownFacts | null
  body?: string // older sites: a couple of paragraphs instead of facts
  place: [string, string | null | undefined][] // County / Township / School district
  kicker: ReactNode
  tone: 'editorial' | 'cinematic'
  // A photograph of the town itself (its station, main street...) - never the house.
  photo?: { url: string; credit?: string | null; caption?: string | null; source_url?: string | null } | null
  onExplore?: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.classList.add('is-in'); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect() } }, { threshold: 0.12 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const f = facts || {}
  const rich = hasTownFacts(f)
  const paras = (body || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean)
  const facts3 = place.filter(([, v]) => v && !/^none/i.test(String(v)))
  const editorial = tone === 'editorial'
  const display = 'sp-display'
  const label = editorial ? 'sp-mono' : ''
  const downtown = f.downtown?.name ? f.downtown : null
  const around = (f.getting_around || []).filter(g => g.label)

  const cards: { key: string; node: ReactNode }[] = []
  if (downtown) cards.push({ key: 'downtown', node: (
    <>
      <div className="flex items-start justify-between">
        <span className="tw-icon"><Store className="h-4 w-4" strokeWidth={1.5} /></span>
        <span className="tw-pin" aria-hidden><MapPin className="h-6 w-6" strokeWidth={1.4} /><i /></span>
      </div>
      <p className={`${label} mt-4 text-[10px] uppercase tracking-[0.28em] tw-faint`}>Downtown</p>
      <h3 className={`${display} mt-1 text-[1.6rem] leading-tight`}>{downtown.name}</h3>
      {downtown.where && <p className="mt-0.5 text-[13px] tw-muted">{downtown.where}</p>}
      {!!downtown.highlights?.length && (
        <ul className="mt-3 space-y-1.5">
          {downtown.highlights.map((h, i) => (
            <li key={h} className="tw-line flex items-center gap-2.5 text-[14px]" style={{ ['--d' as string]: `${420 + i * 110}ms` }}>
              <span className="tw-dot" /> {h}
            </li>
          ))}
        </ul>
      )}
    </>
  ) })
  if (f.why_move?.length) cards.push({ key: 'why', node: (
    <>
      <span className="tw-icon"><Heart className="h-4 w-4" strokeWidth={1.5} /></span>
      <p className={`${label} mt-4 text-[10px] uppercase tracking-[0.28em] tw-faint`}>Why people move here</p>
      <ol className="mt-3 space-y-2.5">
        {f.why_move.map((w, i) => (
          <li key={w} className="tw-line flex gap-3" style={{ ['--d' as string]: `${520 + i * 120}ms` }}>
            <span className={`${display} tw-accent w-7 shrink-0 text-2xl leading-none`}>{String(i + 1).padStart(2, '0')}</span>
            <span className="pt-0.5 text-[14px] leading-snug">{w}</span>
          </li>
        ))}
      </ol>
    </>
  ) })
  if (around.length) cards.push({ key: 'around', node: (
    <>
      <span className="tw-icon"><TrainFront className="h-4 w-4" strokeWidth={1.5} /></span>
      <p className={`${label} mt-4 text-[10px] uppercase tracking-[0.28em] tw-faint`}>Getting around</p>
      <div className="relative mt-3 pl-7">
        {/* The route: a line that draws itself from the home down to each stop. */}
        <svg className="tw-route" viewBox="0 0 12 100" preserveAspectRatio="none" aria-hidden><line x1="6" y1="0" x2="6" y2="100" /></svg>
        <span className="tw-home" aria-hidden />
        <ul className="space-y-3">
          <li className={`${label} text-[10px] uppercase tracking-[0.28em] tw-faint`}>From the home</li>
          {around.map((g, i) => (
            <li key={g.label} className="tw-stop" style={{ ['--d' as string]: `${700 + i * 260}ms` }}>
              <span className="tw-stop-dot" aria-hidden />
              <p className="text-[14px] font-medium leading-snug">{g.label}</p>
              {g.detail && <p className="text-[12px] tw-muted">{g.detail}</p>}
            </li>
          ))}
        </ul>
      </div>
    </>
  ) })
  if (f.outdoors?.length) cards.push({ key: 'outdoors', node: (
    <>
      <span className="tw-icon"><Trees className="h-4 w-4" strokeWidth={1.5} /></span>
      <p className={`${label} mt-4 text-[10px] uppercase tracking-[0.28em] tw-faint`}>The outdoors</p>
      <ul className="mt-3 space-y-1.5">
        {f.outdoors.map((o, i) => (
          <li key={o} className="tw-line flex items-center gap-2.5 text-[14px]" style={{ ['--d' as string]: `${600 + i * 110}ms` }}><span className="tw-leaf" aria-hidden />{o}</li>
        ))}
      </ul>
    </>
  ) })
  if (f.whats_new) cards.push({ key: 'new', node: (
    <>
      <p className={`${label} flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] tw-accent`}><span className="tw-live" /> New in town</p>
      <p className="mt-3 text-[15px] leading-snug">{f.whats_new}</p>
    </>
  ) })

  return (
    <section ref={ref} id="town" className={`tw tw-${tone} sp-loop relative scroll-mt-16 overflow-hidden px-5 py-20 sm:px-10 lg:py-16`}>
      <style>{TW_CSS}</style>
      <div className="tw-glow" aria-hidden />
      <div className="relative mx-auto grid max-w-[1440px] gap-10 lg:grid-cols-12 lg:gap-12">
        {/* Left: who the town is - name, one line, the facts, what it's known for, a photo of it */}
        <div className="lg:col-span-5">
          <div className="tw-rise" style={{ ['--d' as string]: '0ms' }}>
            {kicker}
            <h2 className={`${display} mt-4 text-[clamp(2.8rem,6vw,5.6rem)] leading-[0.9] tracking-[-0.03em] ${editorial ? '' : 'font-light'}`}>
              Life in <em className="tw-accent italic">{name}</em>
            </h2>
            {f.tagline && <p className={`${display} mt-4 text-[clamp(1.15rem,1.7vw,1.5rem)] italic leading-snug tw-soft`}>{f.tagline}</p>}
          </div>
          {facts3.length > 0 && (
            <dl className="tw-rise mt-6 flex flex-wrap gap-x-8 gap-y-3" style={{ ['--d' as string]: '120ms' }}>
              {facts3.map(([l, v]) => (
                <div key={l}>
                  <dt className={`${label} text-[10px] uppercase tracking-[0.28em] tw-faint`}>{l}</dt>
                  <dd className={`${display} mt-0.5 text-xl`}>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {!!f.known_for?.length && (
            <div className="mt-6 flex flex-wrap gap-2">
              {f.known_for.map((k, i) => (
                <span key={k} className="tw-pill" style={{ ['--d' as string]: `${260 + i * 90}ms` }}><Sparkles className="h-3 w-3" /> {k}</span>
              ))}
            </div>
          )}
          {photo?.url && (
            <figure className="tw-photo">
              <div className="tw-photo-in">
              <img src={photo.url} alt={photo.caption || `${name}`} loading="lazy" />
              <figcaption>
                {photo.caption && <span className={`${label} tw-photo-cap`}>{photo.caption}</span>}
                {photo.credit && (photo.source_url
                  ? <a href={photo.source_url} target="_blank" rel="noreferrer noopener" className="tw-photo-credit">{photo.credit}</a>
                  : <span className="tw-photo-credit">{photo.credit}</span>)}
              </figcaption>
              </div>
            </figure>
          )}
        </div>

        {/* Right: the details, as cards that always fill the row */}
        <div className="lg:col-span-7 lg:self-center">
          {rich ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 sm:[&>*:last-child:nth-child(odd)]:col-span-2">
                {cards.map((c, i) => (
                  <article key={c.key} className="tw-card tw-rise" style={{ ['--d' as string]: `${200 + i * 110}ms` }}>{c.node}</article>
                ))}
              </div>
              {onExplore && (
                <button onClick={onExplore} className="tw-card tw-explore tw-rise group mt-3 flex w-full items-center justify-between gap-4 text-left !py-4" style={{ ['--d' as string]: '640ms' }}>
                  <span className="flex items-center gap-3">
                    <span className="tw-icon !h-9 !w-9"><Compass className="h-4 w-4 transition duration-700 group-hover:rotate-180" strokeWidth={1.5} /></span>
                    <span>
                      <span className={`${display} block text-lg`}>Explore what’s nearby</span>
                      <span className="block text-[13px] tw-muted">Restaurants, coffee, parks - with distances</span>
                    </span>
                  </span>
                  <ArrowRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-1" />
                </button>
              )}
            </>
          ) : paras.length > 0 && (
            <div className="tw-rise max-w-3xl space-y-5" style={{ ['--d' as string]: '200ms' }}>
              {paras.map((p, i) => <p key={i} className="text-[17px] leading-[1.85] tw-soft">{p}</p>)}
            </div>
          )}
          <p className={`${label} tw-rise mt-4 text-[10px] tracking-[0.06em] tw-faint`} style={{ ['--d' as string]: '700ms' }}>General area information - please verify anything important.</p>
        </div>
      </div>
    </section>
  )
}

const TW_CSS = `
.tw-editorial{background:var(--deep,#10201e);color:#f3efe6;--tw-accent:var(--ee-gold,#d9c38d);--tw-line:rgba(243,239,230,.16);--tw-card:rgba(243,239,230,.04)}
.tw-cinematic{background:#0A0A0A;color:#fff;--tw-accent:var(--sp-accent,#C9A24D);--tw-line:rgba(255,255,255,.1);--tw-card:rgba(255,255,255,.03)}
.tw .tw-accent{color:var(--tw-accent)}
.tw .tw-soft{color:color-mix(in srgb,currentColor 82%,transparent)}
.tw .tw-muted{color:color-mix(in srgb,currentColor 58%,transparent)}
.tw .tw-faint{color:color-mix(in srgb,currentColor 45%,transparent)}
.tw-photo{position:relative;margin:1.75rem 0 0;overflow:hidden;aspect-ratio:16/9;transform:scale(.84,.8);transition:transform 1.6s cubic-bezier(.7,0,.2,1) .15s}
.tw-photo-in{position:absolute;inset:0;transform:scale(1.1905,1.25);transition:transform 1.6s cubic-bezier(.7,0,.2,1) .15s}
@media(min-width:1024px){.tw-photo{aspect-ratio:16/8}}
.tw.is-in .tw-photo,.tw.is-in .tw-photo-in{transform:none}
.tw-photo img{width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.16);transition:transform 9s cubic-bezier(.2,.6,.2,1) .15s}
.tw.is-in .tw-photo img{transform:scale(1.02)}
.tw-photo figcaption{position:absolute;inset:auto 0 0 0;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:40px 18px 14px;background:linear-gradient(0deg,rgba(0,0,0,.6),transparent);color:#fff}
.tw-photo-cap{font-size:11px;letter-spacing:.22em;text-transform:uppercase}
.tw-photo-credit{font-size:10px;opacity:.7;text-align:right;max-width:55%}
a.tw-photo-credit:hover{opacity:1;text-decoration:underline}
.tw-cinematic:before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#0A0A0A 0%,rgba(10,10,10,.8) 35%,#0A0A0A 100%)}
.tw-glow{position:absolute;right:-12%;top:-20%;width:60vw;height:60vw;max-width:820px;max-height:820px;border-radius:999px;background:radial-gradient(circle,color-mix(in srgb,var(--tw-accent) 16%,transparent),transparent 65%);opacity:0;transition:opacity 2s ease}
.tw.is-in .tw-glow{opacity:1}
.tw-card{position:relative;overflow:hidden;border:1px solid var(--tw-line);background:var(--tw-card);padding:1.35rem 1.5rem;transition:border-color .5s,transform .5s cubic-bezier(.2,.7,.2,1),background .5s}
.tw-card:hover{border-color:color-mix(in srgb,var(--tw-accent) 55%,transparent);transform:translateY(-3px);background:color-mix(in srgb,var(--tw-accent) 6%,transparent)}
.tw-card:after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:var(--tw-accent);transform:scaleX(0);transform-origin:left;transition:transform .8s cubic-bezier(.2,.7,.2,1)}
.tw-card:hover:after{transform:scaleX(1)}
.tw-leaf{width:7px;height:7px;flex-shrink:0;border-radius:0 999px;background:var(--tw-accent)}
.tw-icon{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:999px;border:1px solid color-mix(in srgb,var(--tw-accent) 50%,transparent);color:var(--tw-accent)}
.tw-pill{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1px solid color-mix(in srgb,var(--tw-accent) 45%,transparent);background:color-mix(in srgb,var(--tw-accent) 8%,transparent);font-size:13px;opacity:0;transform:translateY(8px) scale(.94)}
.tw-pill svg{color:var(--tw-accent)}
.tw.is-in .tw-pill{animation:twPop .6s cubic-bezier(.34,1.56,.64,1) var(--d,0ms) both}
@keyframes twPop{from{opacity:0;transform:translateY(8px) scale(.9)}to{opacity:1;transform:none}}
.tw-rise{opacity:0;transform:translateY(26px)}
.tw.is-in .tw-rise{animation:twRise .9s cubic-bezier(.2,.7,.2,1) var(--d,0ms) both}
@keyframes twRise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
.tw-line{opacity:0;transform:translateX(-10px)}
.tw.is-in .tw-line{animation:twLine .7s cubic-bezier(.2,.7,.2,1) var(--d,0ms) both}
@keyframes twLine{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
.tw-dot{width:6px;height:6px;flex-shrink:0;transform:rotate(45deg);background:var(--tw-accent)}
.tw-pin{position:relative;color:var(--tw-accent);opacity:0;transform:translateY(-26px)}
.tw.is-in .tw-pin{animation:twDrop .9s cubic-bezier(.34,1.56,.64,1) .5s both}
@keyframes twDrop{from{opacity:0;transform:translateY(-26px)}to{opacity:1;transform:none}}
.tw-pin i{position:absolute;left:50%;bottom:-6px;width:18px;height:6px;margin-left:-9px;border-radius:999px;border:1px solid var(--tw-accent);opacity:0}
.tw.is-in .tw-pin i{animation:twRing 2.4s ease-out 1.3s infinite}
@keyframes twRing{0%{opacity:.8;transform:scale(.4)}100%{opacity:0;transform:scale(2.4)}}
.tw-route{position:absolute;left:0;top:6px;bottom:6px;width:12px;height:calc(100% - 12px);overflow:visible}
.tw-route line{stroke:var(--tw-accent);stroke-width:1.5;stroke-dasharray:4 5;vector-effect:non-scaling-stroke;opacity:.7;clip-path:inset(0 0 100% 0)}
.tw.is-in .tw-route line{animation:twDraw 1.8s cubic-bezier(.4,0,.2,1) .6s both}
@keyframes twDraw{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
.tw-home{position:absolute;left:0;top:2px;width:12px;height:12px;border-radius:999px;background:var(--tw-accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--tw-accent) 25%,transparent)}
.tw-stop{position:relative;opacity:0;transform:translateY(8px)}
.tw.is-in .tw-stop{animation:twRise .7s cubic-bezier(.2,.7,.2,1) var(--d,0ms) both}
/* Centred on the route line: the list sits 1.75rem (pl-7) right of the line's 12px lane, so the
   12px dot starts exactly 1.75rem back - it used to be 2rem, which put every stop 4px off the line. */
.tw-stop-dot{position:absolute;left:-1.75rem;top:.3rem;width:12px;height:12px;border-radius:999px;border:2px solid var(--tw-accent);background:var(--deep,#0A0A0A);box-sizing:border-box}
.tw-cinematic .tw-stop-dot{background:#0A0A0A}
.tw-live{position:relative;width:8px;height:8px;border-radius:999px;background:var(--tw-accent)}
.tw-live:after{content:"";position:absolute;inset:-4px;border-radius:999px;border:1px solid var(--tw-accent);animation:twRing 2s ease-out infinite}
.tw-explore{cursor:pointer;color:inherit}
@media(prefers-reduced-motion:reduce){.tw-rise,.tw-pill,.tw-line,.tw-pin,.tw-stop{opacity:1;transform:none;animation:none!important}.tw-route line{clip-path:none;animation:none!important}.tw-pin i,.tw-live:after{animation:none!important}.tw-photo,.tw-photo-in{transform:none;transition:none}.tw-photo img{transform:none;transition:none}}
`
