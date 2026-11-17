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
import { ChevronDown, ChevronUp, Flame, Loader2, Pause, Play, RefreshCw, Sunset, X } from 'lucide-react'
import api from '@/lib/api-service'
import { MotionSettings, photosForFastCut, thumbOf } from '@/lib/studio/cinematic'

const gold = 'text-[#8b7355] dark:text-[#d7b974]'
const card = 'rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#151517] sm:p-5'
const pickCls = (on: boolean) => `relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition ${on ? 'border-[#111827] bg-[#f8f5ee] dark:border-white dark:bg-white/10' : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/25'}`

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

export type FastPlanRow = { photo: string; start: number; seconds: number; what: string; stat?: { value: string; label: string } | null; role: string; fire: boolean; dusk: boolean; movable: boolean; kind?: string }
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

const about = (v: number) => (v < 0.1 ? 'Less than 0.1%' : `About ${pctText(v)}`)

export function SpeedPicker({ s, up, fast }: { s: MotionSettings; up: (fn: (d: MotionSettings) => MotionSettings) => void; fast: boolean }) {
  const speed = s.speed === 'now' ? 'now' : 'save'
  const n = Math.max(1, s.photos.filter(p => !p.hidden).length)
  const seconds = fast ? ((s.length || 30) >= 45 ? 57 : 30) : (s.length || 30)
  const [use, setUse] = useState<{ lo: number; hi: number; now: number } | null>(null)
  useEffect(() => {
    let alive = true
    api.mediaLab.motion.estimate(n, true, seconds, fast).then(r => {
      const d = r.data
      if (!alive || !r.success || !d || d.speed_save_percent == null || d.speed_now_percent == null) return
      setUse({ lo: d.speed_save_percent, hi: d.speed_save_percent_max ?? d.speed_save_percent, now: d.speed_now_percent })
    })
    return () => { alive = false }
  }, [n, seconds, fast])
  const same = !!use && use.now - use.lo < 0.05
  // how much less Save usage uses, rounded to 5 (e.g. "about 50% less")
  const less = use && !same && use.now > 0 ? Math.round(((use.now - use.lo) / use.now) * 20) * 5 : 0
  const opts = [
    { id: 'save' as const, label: 'Save usage', tag: 'Recommended',
      blurb: fast ? 'Ready in about 25 minutes. The AI and the video maker wait in the cheaper line.' : 'The video maker takes the slower, cheaper line. Usually a few minutes longer.',
      use: use ? `${about(use.lo)} of your monthly AI` : '', save: less >= 10 ? `Uses about ${less}% less` : '' },
    { id: 'now' as const, label: 'Make it now', tag: '',
      blurb: fast ? 'Ready in about 15 minutes, at the full price.' : 'The fastest way, start to finish.',
      use: use ? `${about(use.now)} of your monthly AI` : '', save: '' },
  ]
  return (
    <div className={card} data-testid="speed-picker">
      <Title title="How soon do you need it?" sub="The exact same video and quality either way. Save usage just takes a little longer, and uses much less of your monthly AI" />
      <div className="grid grid-cols-2 gap-2.5">
        {opts.map(o => (
          <button key={o.id} type="button" onClick={() => up(d => ({ ...d, speed: o.id }))} aria-pressed={speed === o.id} data-testid={`speed-${o.id}`} className={`${pickCls(speed === o.id)} p-3`}>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-black text-[#111827] dark:text-white">{o.label}</span>
              {o.tag && <span className="rounded-full bg-[#C9A24D]/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-[#8b7355] dark:text-[#d7b974]">{o.tag}</span>}
            </span>
            <span className="mt-1 block text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">{o.blurb}</span>
            {o.use && <span className={`mt-1.5 block text-[10.5px] font-black leading-tight ${gold}`} data-testid={`speed-${o.id}-use`}>{o.use}</span>}
            {o.save && <span className="mt-1 block text-[10.5px] font-black leading-tight text-emerald-700 dark:text-emerald-400" data-testid="speed-save-less">{o.save}</span>}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-semibold text-gray-400">
        {same ? 'Right now both use the same amount for this video. ' : ''}{fast ? 'That covers everything this video uses: the AI editor, getting the photos ready, the twilight ending and making it. If a cheaper line is busy, Save usage does that part the normal way - never more than Make it now.' : 'That is for making the video.'}
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
  return (
    <div className={card} data-testid="fast-photos">
      <Title title="Photos in your video" sub="Every good photo is in to start with. Tap any you don't want - the AI editor picks the order and leaves out near-duplicates."
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
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {pool.map(it => {
              const on = inBySrc.has(it.source)
              return (
                <button key={it.source} type="button" onClick={() => toggle(it.source)} aria-pressed={on} title={it.label}
                  className={`relative aspect-[4/3] overflow-hidden rounded-lg border-2 ${on ? 'border-[#111827] dark:border-white' : 'border-transparent opacity-40'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumbOf(it.clean || it.source) || it.source} alt={it.label || 'Photo'} loading="lazy" className="h-full w-full object-cover" />
                  {on && <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#111827] text-[9px] font-black text-white dark:bg-white dark:text-[#111827]">✓</span>}
                </button>
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
  const swap = (a: string, b: string) => {
    if (!plan) return
    const order = [...plan.order]
    const i = order.indexOf(a), j = order.indexOf(b)
    if (i < 0 || j < 0) return
    ;[order[i], order[j]] = [order[j], order[i]]
    up(d => ({ ...d, fast: { ...(d.fast || {}), order } }))
  }
  const remove = (pid: string) => up(d => ({ ...d, photos: d.photos.filter(p => p.id !== pid), fast: { ...(d.fast || {}), order: (d.fast?.order || []).filter(x => x !== pid) } }))
  const reset = () => up(d => ({ ...d, fast: { ...(d.fast || {}), order: [] } }))
  const movable = (plan?.rows || []).filter(r => r.movable)
  const fmt = (t: number) => `0:${String(Math.floor(t)).padStart(2, '0')}`

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
        <Title title="Your video, shot by shot" sub="The AI editor's order. Move a photo earlier or later, or take it out - the cuts stay on the beat."
          right={<span className="flex shrink-0 items-center gap-3">
            {(s.fast?.order || []).length > 0 && <button type="button" onClick={reset} className={`text-[11px] font-black ${gold} hover:underline`}>AI's order</button>}
            <button type="button" onClick={load} disabled={busy} aria-label="Refresh the plan" className="text-gray-400 hover:text-[#111827] dark:hover:text-white"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></button>
          </span>} />
        {visible.length < FAST_MIN_PHOTOS ? (
          <p className="py-4 text-sm font-bold text-red-600">A Fast Cut needs at least {FAST_MIN_PHOTOS} photos. Go back to Photos and add a few.</p>
        ) : !plan && busy ? (
          <div className="py-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
            <p className="mt-3 text-sm font-black text-[#111827] dark:text-white">The AI editor is looking at every photo</p>
            {slow ? (
              <p className="mx-auto mt-1 max-w-md text-xs font-semibold text-gray-500" data-testid="fast-plan-slow">You picked <b>Save usage</b>, so it is looking the slower way for about half the AI - usually 3 to 6 minutes, {slow.cap} at most. Wait here to check the order, or go on and make it: the video will use the AI editor's order.</p>
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
            <ol className={`space-y-1.5 ${busy ? 'opacity-60' : ''}`}>
              {plan.rows.map((r, i) => {
                const p = bySrc.get(r.photo)
                const mi = movable.findIndex(m => m.photo === r.photo && m.start === r.start)
                return (
                  <li key={`${r.photo}-${i}`} className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 p-1.5 dark:border-white/5 dark:bg-white/[0.03]">
                    <span className="w-8 shrink-0 text-center text-[10px] font-black tabular-nums text-gray-400">{fmt(r.start)}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbOf(p?.clean || p?.source) || ''} alt="" loading="lazy" className="h-11 w-16 shrink-0 rounded-md object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-xs font-black capitalize leading-tight text-[#111827] dark:text-white">{r.role === 'opening' ? 'Opening · ' : r.role === 'closing' ? 'Ending · ' : ''}{r.what || 'Photo'}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-[10px] font-bold text-gray-500">
                        <span>{r.seconds.toFixed(1)} sec</span>
                        {r.stat && <span className={gold}>{r.stat.value} {r.stat.label}</span>}
                        {r.fire && <span className="inline-flex items-center gap-0.5"><Flame className="h-3 w-3" /> fire moves</span>}
                        {r.dusk && <span className="inline-flex items-center gap-0.5"><Sunset className="h-3 w-3" /> turns to dusk</span>}
                      </span>
                    </span>
                    {r.movable && (
                      <span className="flex shrink-0 items-center">
                        <button type="button" disabled={mi <= 0 || busy} onClick={() => swap(r.photo, movable[mi - 1].photo)} aria-label="Move earlier" className="p-1.5 text-gray-400 hover:text-[#111827] disabled:opacity-20 dark:hover:text-white"><ChevronUp className="h-4 w-4" /></button>
                        <button type="button" disabled={mi < 0 || mi >= movable.length - 1 || busy} onClick={() => swap(r.photo, movable[mi + 1].photo)} aria-label="Move later" className="p-1.5 text-gray-400 hover:text-[#111827] disabled:opacity-20 dark:hover:text-white"><ChevronDown className="h-4 w-4" /></button>
                        <button type="button" disabled={busy || visible.length <= FAST_MIN_PHOTOS} onClick={() => remove(r.photo)} aria-label="Take this photo out" className="p-1.5 text-gray-400 hover:text-red-600 disabled:opacity-20"><X className="h-4 w-4" /></button>
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
          </>
        ) : null}
      </div>
    </div>
  )
}
