'use client'

// Fast Cut - the beat-synced kind of AI Video (owner 11/14-11/16). These are its own pieces of the
// video editor (CinematicEditor.tsx); everything else - what it's for, the look and colours, branding,
// words, making it - is the same steps a Cinematic Video uses.
//   KindPicker    Cinematic or Fast Cut, each with an example to watch
//   FastSetup     30 seconds or a minute, and the song
//   FastPhotos    which photos are in (all the good ones to start with)
//   FastPlanCard  the plan before it is made: every shot in order, the stat slides, move / swap / remove
// The edit itself is made on the server (backend fast_cut_edit.py + fast_cut_recipe.py).

import { useCallback, useEffect, useRef, useState } from 'react'
import FastShotBoard from './FastShotBoard'
import { Loader2, Pause, Play, RefreshCw } from 'lucide-react'
import api from '@/lib/api-service'
import { MotionSettings, photosForFastCut, sectionsOf, thumbOf } from '@/lib/studio/cinematic'

const gold = 'text-[#8b7355] dark:text-[#d7b974]'
const card = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-[#151517] sm:p-5'
const pickCls = (on: boolean) => `relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition hover:-translate-y-0.5 dark:bg-[#151517] ${on ? 'border-[#C9A24D] shadow-[0_0_34px_-14px_rgba(201,162,77,0.8)]' : 'border-gray-200 hover:border-[#C9A24D]/50 dark:border-gray-800'}`

export const FAST_MIN_PHOTOS = 8
/** Every song is cut to the same beat pattern, so the edit is identical - only the sound changes. */
export const FAST_SONGS: { id: string; label: string; blurb: string }[] = [
  { id: 'skyline', label: 'Skyline', blurb: 'Modern and confident' },
  { id: 'authority', label: 'Authority', blurb: 'Strings and brass' },
  { id: 'ivory', label: 'Ivory', blurb: 'Grand piano' },
  { id: 'velvet', label: 'Velvet', blurb: 'Smooth and warm' },
  { id: 'marble', label: 'Marble', blurb: 'Clean house beat' },
  { id: 'sunset', label: 'Sunset', blurb: 'Laid-back groove' },
]

export type FastPlanRow = { photo: string; start: number; seconds: number; what: string; stat?: { value: string; label: string } | null; role: string; fire: boolean; dusk: boolean; movable: boolean; kind?: string; section?: string | null }
export type FastPlan = {
  rows: FastPlanRow[]; order: string[]; seconds: number; song: string; long: boolean; usable: number; needed: number; needed_long: number
  recommend: 30 | 60; skipped: string[]; seconds_short: number; seconds_long: number
}

function Title({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-serif text-lg font-black leading-tight text-[#111827] dark:text-white">{title}</p>
        {sub && <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

// ------------------------------------------------------------------ Cinematic or Fast Cut

export function KindPicker({ kind, onChange }: { kind: 'cinematic' | 'fastcut'; onChange: (k: 'cinematic' | 'fastcut') => void }) {
  const kinds = [
    { id: 'cinematic' as const, label: 'Cinematic', blurb: 'Slow and elegant. A film camera glides through a few of your best photos.', video: '/motion/example/example.mp4', poster: '/motion/example/example.jpg', tall: false },
    { id: 'fastcut' as const, label: 'Fast Cut', blurb: 'Quick and punchy. Lots of photos, every cut on the beat of the music.', video: '/motion/example/fastcut-wide.mp4', poster: '/motion/example/fastcut-wide.jpg', tall: false },
  ]
  return (
    <div className={card} data-testid="video-kind">
      <Title title="Which kind of video?" sub="Both use your photos, your words and your branding - tap one to watch an example" />
      <div className="grid grid-cols-2 gap-2.5">
        {kinds.map(k => (
          <button key={k.id} type="button" onClick={() => onChange(k.id)} aria-pressed={kind === k.id} data-testid={`video-kind-${k.id}`} className={pickCls(kind === k.id)}>
            <span className="relative block aspect-video w-full overflow-hidden bg-black">
              <video src={k.video} poster={k.poster} muted loop playsInline autoPlay preload="metadata" className={`absolute inset-0 h-full w-full ${k.tall ? 'object-contain' : 'object-cover'}`} />
            </span>
            <span className="block p-3">
              <span className="block text-sm font-black text-[#111827] dark:text-white">{k.label}</span>
              <span className="mt-0.5 block text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{k.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ the preview spot (beside the options, or on top on a phone)

/** Where a Cinematic Video shows its live preview, a Fast Cut shows a real finished one in the chosen shape. */
export function FastSidePreview({ format, maxH }: { format?: string; maxH?: string }) {
  const wide = format === '16:9'
  const name = wide ? 'fastcut-wide' : 'fastcut-tall'
  return (
    <div className="space-y-2" data-testid="fast-side-preview">
      <div className={`mx-auto overflow-hidden rounded-2xl bg-black shadow-xl ${wide ? 'aspect-video w-full' : 'aspect-[9/16]'}`} style={wide ? { maxHeight: maxH } : { maxHeight: maxH, height: maxH, maxWidth: '100%' }}>
        <video key={name} src={`/motion/example/${name}.mp4`} poster={`/motion/example/${name}.jpg`} controls playsInline preload="none" className="h-full w-full object-contain" data-testid={`fast-example-${wide ? 'wide' : 'tall'}`} />
      </div>
      <p className="truncate px-1 text-[11px] font-bold text-gray-400">Example Fast Cut · 57 sec · press play, with the sound on</p>
    </div>
  )
}

// ------------------------------------------------------------------ the example, with its music, in the shape chosen

export function FastExample({ format }: { format?: string }) {
  const wide = format === '16:9'
  const name = wide ? 'fastcut-wide' : 'fastcut-tall'
  return (
    <div className={card} data-testid="fast-example">
      <Title title="See a finished Fast Cut" sub={`A real one-minute Fast Cut, ${wide ? 'widescreen' : 'vertical'} - press play, with the sound on`} />
      <div className={`mx-auto overflow-hidden rounded-2xl bg-black ${wide ? 'aspect-video w-full' : 'aspect-[9/16] w-full max-w-[250px]'}`}>
        <video key={name} src={`/motion/example/${name}.mp4`} poster={`/motion/example/${name}.jpg`} controls playsInline preload="none" className="h-full w-full object-contain" data-testid={`fast-example-${wide ? 'wide' : 'tall'}`} />
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ how soon: Save usage or Make it now

const pctText = (v: number) => (v < 0.1 ? 'less than 0.1%' : `${v < 10 ? Math.max(0.1, Math.round(v * 10) / 10) : Math.round(v)}%`)

export function SpeedPicker({ s, up, fast }: { s: MotionSettings; up: (fn: (d: MotionSettings) => MotionSettings) => void; fast: boolean }) {
  const speed = s.speed === 'now' ? 'now' : 'save'
  const n = Math.max(1, s.photos.filter(p => !p.hidden).length)
  const seconds = fast ? ((s.length || 30) >= 45 ? 57 : 30) : (s.length || 30)
  const [use, setUse] = useState<{ lo: number; hi: number; now: number; readySave?: number | null; readyNow?: number | null; aheadSave: number; aheadNow: number } | null>(null)
  useEffect(() => {
    let alive = true
    const load = () => api.mediaLab.motion.estimate(n, true, seconds, fast).then(r => {
      const d = r.data
      if (!alive || !r.success || !d || d.speed_save_percent == null || d.speed_now_percent == null) return
      setUse({ lo: d.speed_save_percent, hi: d.speed_save_percent_max ?? d.speed_save_percent, now: d.speed_now_percent,
        readySave: d.speed_save_ready_minutes, readyNow: d.speed_now_ready_minutes, aheadSave: d.speed_save_ahead || 0, aheadNow: d.speed_now_ahead || 0 })
    })
    load()
    const t = setInterval(load, 60000)   // the line changes: keep the ready times current while the page is open
    return () => { alive = false; clearInterval(t) }
  }, [n, seconds, fast])
  const same = !!use && use.now - use.lo < 0.05
  // how much less Save usage uses (rounded to 5: "about 50% less") and how much faster Make it now spends it ("2x")
  const less = use && !same && use.now > 0 ? Math.round(((use.now - use.lo) / use.now) * 20) * 5 : 0
  const times = use && !same && use.lo > 0 ? Math.round((use.now / use.lo) * 2) / 2 : 0
  // the real wait right now, the line ahead included (the server works it out); before it answers, the usual times
  const readyText = (min: number | null | undefined, usual: number, ahead: number) => {
    const m = min ?? usual
    const t = m >= 90 ? `about ${Math.round(m / 30) / 2} hours` : `about ${m} minutes`
    return `Ready in ${t}${ahead > 0 ? ` · ${ahead} ${ahead === 1 ? 'video' : 'videos'} ahead of yours` : ''}`
  }
  const long = (s.length || 30) >= 45
  const opts = [
    { id: 'save' as const, label: 'Save usage', tag: 'Recommended', ready: fast ? readyText(use?.readySave, long ? 33 : 25, use?.aheadSave || 0) : 'Ready a few minutes later',
      pct: use ? use.lo : null, note: less >= 10 ? `Uses about ${less}% less` : '', good: true },
    { id: 'now' as const, label: 'Make it now', tag: '', ready: fast ? readyText(use?.readyNow, long ? 21 : 15, use?.aheadNow || 0) : 'Ready soonest',
      pct: use ? use.now : null, note: times >= 1.3 ? `Spends your AI usage ${times}x faster` : '', good: false },
  ]
  return (
    <div className={card} data-testid="speed-picker">
      <Title title="How soon do you need it?" sub="The exact same video and quality either way - Save usage just takes a little longer" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {opts.map(o => {
          const on = speed === o.id
          return (
            <button key={o.id} type="button" onClick={() => up(d => ({ ...d, speed: o.id }))} aria-pressed={on} data-testid={`speed-${o.id}`}
              className={`relative flex flex-col rounded-2xl border-2 p-4 text-left transition ${on
                ? 'border-[#C9A24D] bg-[#fbf7ee] shadow-[0_6px_22px_-10px_rgba(201,162,77,0.55)] dark:border-[#d7b974] dark:bg-[#d7b974]/10'
                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/25'}`}>
              <span className="flex items-center gap-2.5">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-[#C9A24D] bg-[#C9A24D] dark:border-[#d7b974] dark:bg-[#d7b974]' : 'border-gray-300 dark:border-white/25'}`}>
                  {on && <svg viewBox="0 0 12 12" className="h-3 w-3 text-white dark:text-[#151517]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" /></svg>}
                </span>
                <span className="text-[15px] font-black text-[#111827] dark:text-white">{o.label}</span>
                {o.tag && <span className="ml-auto rounded-full bg-[#C9A24D] px-2.5 py-1 text-[9.5px] font-black uppercase tracking-[0.1em] text-white dark:bg-[#d7b974] dark:text-[#151517]">{o.tag}</span>}
              </span>
              <span className="mt-3 flex items-baseline gap-1.5" data-testid={`speed-${o.id}-use`}>
                {o.pct == null
                  ? <span className="h-7 w-16 animate-pulse rounded-md bg-gray-100 dark:bg-white/10" />
                  : <><span className={`text-[28px] font-black leading-none tracking-tight ${gold}`}>{o.pct < 0.1 ? '<0.1%' : pctText(o.pct)}</span>
                    <span className="text-[11.5px] font-bold text-gray-500 dark:text-gray-400">of your monthly AI</span></>}
              </span>
              {o.note && (
                <span data-testid={o.good ? 'speed-save-less' : 'speed-now-faster'}
                  className={`mt-2.5 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${o.good
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'}`}>
                  {o.good ? '↓' : '↑'} {o.note}
                </span>
              )}
              <span className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 dark:text-gray-400">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="8" cy="8" r="6.2" /><path d="M8 4.6V8l2.3 1.5" /></svg>
                {o.ready}
              </span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-[11.5px] font-semibold leading-snug text-gray-400">
        {same ? 'Right now both use the same amount for this video. ' : ''}{fast ? 'This counts everything that goes into the video, start to finish. Save usage never uses more than Make it now.' : 'That is for making the video.'}
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ length and song

export function FastSetup({ s, up, usable }: { s: MotionSettings; up: (fn: (d: MotionSettings) => MotionSettings) => void; usable: number | null }) {
  const long = (s.length || 30) >= 45
  const [playing, setPlaying] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const stop = useCallback(() => { audio.current?.pause(); audio.current = null; setPlaying(null) }, [])
  useEffect(() => stop, [stop])
  const toggle = (id: string) => {
    if (playing === id) { stop(); return }
    audio.current?.pause()
    const a = new Audio(`/motion/fastcut/${id}.wav`)
    a.onended = () => setPlaying(null)
    a.play().catch(() => setPlaying(null))
    audio.current = a
    setPlaying(id)
  }
  const enoughForLong = usable == null || usable >= 50
  // Each length's share of the monthly AI, with Save usage (the pre-picked speed) - like the Cinematic length buttons
  const n = Math.max(1, usable ?? (s.pool || s.photos).length)
  const [use, setUse] = useState<Record<number, number>>({})
  useEffect(() => {
    let alive = true
    Promise.all([30, 57].map(sec => api.mediaLab.motion.estimate(n, true, sec, true).then(r => [sec, r.success && r.data ? (r.data.analyze_percent || 0) + (r.data.speed_save_percent ?? 0) : null] as const).catch(() => [sec, null] as const)))
      .then(rows => { if (alive) setUse(Object.fromEntries(rows.filter(([, v]) => v != null)) as Record<number, number>) })
    return () => { alive = false }
  }, [n])
  return (
    <>
      <div className={card}>
        <Title title="How long?" sub="Same cuts on the same beats - a minute just shows about twice the photos" />
        <div className="grid grid-cols-2 gap-2.5">
          {[{ len: 30, big: '30', unit: 'sec', hint: 'About 22 photos. Best for most homes.' }, { len: 60, big: '57', unit: 'sec', hint: 'About 50 photos. Counts as a short video everywhere.' }].map(o => (
            <button key={o.len} type="button" onClick={() => up(d => ({ ...d, length: o.len }))} aria-pressed={long === (o.len === 60)} data-testid={`fast-length-${o.len}`}
              className={`${pickCls(long === (o.len === 60))} items-center px-3 pb-3 pt-5 text-center`}>
              <span className="font-serif text-3xl font-black leading-none text-[#111827] dark:text-white">{o.big}<span className="ml-0.5 text-sm font-black text-gray-400">{o.unit}</span></span>
              <span className="mt-1.5 text-[10.5px] font-semibold leading-tight text-gray-500">{o.hint}</span>
              {use[o.len === 60 ? 57 : 30] != null && <span className={`mt-1.5 text-[10px] font-black leading-tight ${gold}`}>{use[o.len === 60 ? 57 : 30] < 1 ? 'less than 1%' : `about ${pctText(use[o.len === 60 ? 57 : 30])}`} of your monthly AI</span>}
            </button>
          ))}
        </div>
        {long && !enoughForLong && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
            This home has {usable} usable photos. A minute needs about 50, so a few would be shown twice - 30 seconds will look better.
          </p>
        )}
      </div>
      <div className={card}>
        <Title title="Song" sub="Every song drives the same edit - pick the sound you like" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {FAST_SONGS.map(g => {
            const on = (s.song || 'skyline') === g.id
            return (
              <div key={g.id} className={`${pickCls(on)} !flex-row items-center gap-2.5 p-2.5`}>
                <button type="button" onClick={() => toggle(g.id)} aria-label={playing === g.id ? `Stop ${g.label}` : `Play ${g.label}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#111827] text-white dark:bg-white dark:text-[#111827]">
                  {playing === g.id ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
                </button>
                <button type="button" onClick={() => up(d => ({ ...d, song: g.id }))} aria-pressed={on} data-testid={`fast-song-${g.id}`} className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-black text-[#111827] dark:text-white">{g.label}</span>
                  <span className="block truncate text-[10.5px] font-semibold text-gray-500 dark:text-gray-400">{g.blurb}</span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ------------------------------------------------------------------ which photos are in

export function FastPhotos({ s, up, ready, failed, onRetry }: { s: MotionSettings; up: (fn: (d: MotionSettings) => MotionSettings) => void; ready: boolean; failed?: string | null; onRetry?: () => void }) {
  const pool = (s.pool || []).filter(it => it.analyzed && it.room && it.room !== 'skip')
  const inBySrc = new Map(s.photos.filter(p => !p.hidden).map(p => [p.source, p]))
  // the first time the photos are sorted: every good photo is in
  const filled = useRef(false)
  useEffect(() => {
    if (!ready || filled.current) return
    filled.current = true
    if (s.photos.filter(p => !p.hidden).length < FAST_MIN_PHOTOS) up(d => ({ ...d, photos: photosForFastCut(d) }))
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps
  const toggle = (src: string) => up(d => {
    const has = d.photos.find(p => p.source === src)
    if (has) return { ...d, photos: d.photos.filter(p => p.source !== src) }
    const all = photosForFastCut(d, true)
    const add = all.find(p => p.source === src)
    return add ? { ...d, photos: [...d.photos, add] } : d
  })
  const n = inBySrc.size
  // room by room, like a Cinematic Video's picking (owner 11/17: the same features on both kinds)
  const rooms = sectionsOf(pool)
  const setRoom = (srcs: string[], on: boolean) => up(d => {
    if (!on) return { ...d, photos: d.photos.filter(p => !srcs.includes(p.source)) }
    const have = new Set(d.photos.map(p => p.source))
    const add = photosForFastCut(d, true).filter(p => srcs.includes(p.source) && !have.has(p.source))
    return { ...d, photos: [...d.photos, ...add] }
  })
  return (
    <div className={card} data-testid="fast-photos">
      <Title title="Photos in your video" sub="Every good photo is in to start with, room by room. Tap any you don't want - the AI editor picks the order and leaves out near-duplicates; you can rearrange it on Your shots."
        right={<button type="button" onClick={() => up(d => ({ ...d, photos: photosForFastCut(d) }))} className={`shrink-0 text-[11px] font-black ${gold} hover:underline`}>Use all</button>} />
      {failed && !ready ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/10" data-testid="fast-photos-failed">
          <p className="text-sm font-black text-red-700 dark:text-red-300">{failed}</p>
          <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white dark:bg-white dark:text-[#111827]">Try again</button>
        </div>
      ) : !ready ? (
        <p className="flex items-center gap-2 py-6 text-sm font-bold text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Sorting your photos…</p>
      ) : (
        <>
          <p className={`mb-2 text-[11px] font-black ${n < FAST_MIN_PHOTOS ? 'text-red-600' : 'text-gray-500'}`}>{n} of {pool.length} photos in{n < FAST_MIN_PHOTOS ? ` - a Fast Cut needs at least ${FAST_MIN_PHOTOS}` : ''}</p>
          <div className="space-y-3.5" data-testid="fast-photo-rooms">
            {rooms.map(room => {
              const inRoom = room.photos.filter(it => inBySrc.has(it.source)).length
              const all = inRoom === room.photos.length
              return (
                <section key={room.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-black text-[#111827] dark:text-white">{room.label}<span className="font-bold text-gray-400"> · {inRoom} of {room.photos.length} in</span></p>
                    <button type="button" onClick={() => setRoom(room.photos.map(it => it.source), !all)} className={`shrink-0 text-[10.5px] font-black ${gold} hover:underline`}>{all ? 'Take all out' : 'Put all in'}</button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {room.photos.map(it => {
                      const on = inBySrc.has(it.source)
                      return (
                        <button key={it.source} type="button" onClick={() => toggle(it.source)} aria-pressed={on} title={it.label}
                          className={`relative aspect-[4/3] overflow-hidden rounded-lg border-2 transition ${on ? 'border-[#C9A24D]' : 'border-transparent opacity-40 hover:opacity-70'}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumbOf(it.clean || it.source) || it.source} alt={it.label || 'Photo'} loading="lazy" className="h-full w-full object-cover" />
                          {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#C9A24D] text-[9px] font-black text-[#111827]">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ the plan, before it is made

const STATS: { key: string; label: string }[] = [{ key: 'bedbath', label: 'Beds & baths' }, { key: 'living', label: 'Square feet' }, { key: 'exterior', label: 'Lot size' }]

export function FastPlanCard({ id, s, up, flush }: {
  id: string; s: MotionSettings; up: (fn: (d: MotionSettings) => MotionSettings) => void; flush: (settings?: MotionSettings | null) => Promise<boolean>
}) {
  const [plan, setPlan] = useState<FastPlan | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [usePct, setUsePct] = useState<number | null>(null)
  // "Save usage": the AI editor's look runs in the background on the slower line - ask again until it is there
  const [slow, setSlow] = useState<{ cap: number } | null>(null)
  const again = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waitingSlow = useRef(false)
  const fails = useRef(0)
  useEffect(() => () => { if (again.current) clearTimeout(again.current) }, [])
  const visible = s.photos.filter(p => !p.hidden)
  const bySrc = new Map(s.photos.map(p => [p.id, p]))
  const sig = JSON.stringify([visible.map(p => p.id), s.length, s.song, s.fast?.order || [], s.fast?.stats_off || [], s.sections?.stats, s.facts?.beds, s.facts?.baths, s.facts?.sqft, s.facts?.acres])
  const sRef = useRef(s)
  sRef.current = s
  const load = useCallback(async () => {
    if (sRef.current.photos.filter(p => !p.hidden).length < FAST_MIN_PHOTOS) { setPlan(null); return }
    if (again.current) { clearTimeout(again.current); again.current = null }
    setBusy(true); setErr('')
    await flush(sRef.current)
    const r = await api.mediaLab.motion.fastPlan(id)
    const d = r.data as (FastPlan & { working?: boolean; cap_minutes?: number }) | undefined
    if (r.success && d?.working) {   // still being looked at: keep the waiting screen up and ask again shortly
      setSlow({ cap: d.cap_minutes || 12 }); setPlan(null); waitingSlow.current = true; fails.current = 0
      again.current = setTimeout(() => { void loadRef.current() }, 8000)
      return
    }
    // a dropped request while the slower look is running (the site restarting, a weak signal): keep waiting, ask again
    if ((!r.success || !d) && waitingSlow.current && fails.current < 6) {
      fails.current += 1
      again.current = setTimeout(() => { void loadRef.current() }, 10000)
      return
    }
    waitingSlow.current = false
    setBusy(false); setSlow(null)
    if (!r.success || !d) { setErr(r.error || 'We couldn\'t plan the video just now. Try again in a moment.'); return }
    setPlan(d)
  }, [id, flush])
  const loadRef = useRef(load)
  loadRef.current = load
  useEffect(() => { const t = setTimeout(load, 500); return () => clearTimeout(t) }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let alive = true
    api.mediaLab.motion.estimate(Math.max(1, visible.length), true, (s.length || 30) >= 45 ? 57 : 30, true).then(r => { if (alive && r.success && r.data) setUsePct(r.data.fast_edit_percent ?? null) })
    return () => { alive = false }
  }, [visible.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const off = new Set(s.fast?.stats_off || [])
  const setOff = (key: string, on: boolean) => up(d => {
    const cur = new Set(d.fast?.stats_off || [])
    if (on) cur.delete(key); else cur.add(key)
    return { ...d, fast: { ...(d.fast || {}), stats_off: Array.from(cur) } }
  })
  const remove = (pid: string) => up(d => ({ ...d, photos: d.photos.filter(p => p.id !== pid), fast: { ...(d.fast || {}), order: (d.fast?.order || []).filter(x => x !== pid) } }))
  const reset = () => up(d => ({ ...d, fast: { ...(d.fast || {}), order: [] } }))

  return (
    <div className="space-y-4" data-testid="fast-plan">
      <div className={card}>
        <Title title="Stats on screen" sub="Each one shows once, over a shot long enough to read. Beds and baths always sits on a bedroom or bathroom." />
        <div className="flex flex-wrap gap-2">
          {STATS.map(st => {
            const on = s.sections?.stats !== false && !off.has(st.key)
            return (
              <button key={st.key} type="button" disabled={s.sections?.stats === false} onClick={() => setOff(st.key, !on)} aria-pressed={on}
                className={`rounded-full border-2 px-3.5 py-1.5 text-xs font-black transition disabled:opacity-40 ${on ? 'border-[#111827] bg-[#111827] text-white dark:border-white dark:bg-white dark:text-[#111827]' : 'border-gray-200 text-gray-500 dark:border-white/15'}`}>
                {st.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className={card}>
        <Title title="Your video, shot by shot" sub="The AI editor's order, part by part - it plays left to right, then the next row. Drag a shot in the build-up or the drop to move it, or take it out; the cuts stay on the beat. Locked shots keep their place on the song."
          right={<span className="flex shrink-0 items-center gap-3">
            {(s.fast?.order || []).length > 0 && <button type="button" onClick={reset} className={`text-[11px] font-black ${gold} hover:underline`} title="Puts back the AI editor's order">Reset to AI&apos;s order</button>}
            <button type="button" onClick={load} disabled={busy} aria-label="Refresh the plan" className="text-gray-400 hover:text-[#111827] dark:hover:text-white"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></button>
          </span>} />
        {visible.length < FAST_MIN_PHOTOS ? (
          <p className="py-4 text-sm font-bold text-red-600">A Fast Cut needs at least {FAST_MIN_PHOTOS} photos. Go back to Photos and add a few.</p>
        ) : !plan && busy ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            <p className="mt-3 text-sm font-black text-[#111827] dark:text-white">The AI editor is looking at every photo</p>
            {slow ? (
              <p className="mx-auto mt-1 max-w-md text-xs font-semibold text-gray-500" data-testid="fast-plan-slow">You picked <b>Save usage</b>, so this takes a few minutes (usually 3 to 6) and uses about half as much of your AI. Wait here to check the order, or go on and make it - the video will use the AI editor's order.</p>
            ) : (
              <p className="mt-1 text-xs font-semibold text-gray-500">It picks the order and finds what each photo is showing off. About a minute, once{usePct != null ? ` - about ${usePct < 1 ? 'less than 1' : Math.round(usePct)}% of your monthly AI` : ''}.</p>
            )}
          </div>
        ) : err ? (
          <div className="py-4"><p className="text-sm font-bold text-red-600">{err}</p><button type="button" onClick={load} className={`mt-2 text-xs font-black ${gold} hover:underline`}>Try again</button></div>
        ) : plan ? (
          <>
            <p className="mb-2 text-[11px] font-black text-gray-500">{plan.rows.length} shots · {Math.round(plan.seconds)} seconds · {FAST_SONGS.find(g => g.id === plan.song)?.label || 'Skyline'}
              {plan.skipped.length > 0 ? ` · ${plan.skipped.length} left out (duplicates, floor plans)` : ''}</p>
            {plan.long && plan.usable < plan.needed && (
              <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">A minute needs {plan.needed} photos and {plan.usable} are usable, so a few are shown twice. 30 seconds would use only your best.</p>
            )}
            <FastShotBoard plan={plan} photos={bySrc} busy={busy} opening={s.sections?.opening !== false}
              onOrder={order => up(d => ({ ...d, fast: { ...(d.fast || {}), order } }))} onRemove={remove} canRemove={visible.length > FAST_MIN_PHOTOS} />
          </>
        ) : null}
      </div>
    </div>
  )
}
