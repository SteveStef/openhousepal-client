'use client'

// The Fast Cut's live preview (owner 11/17: "a preview just like the cinematic one"): the real Fast Cut
// video playing in the browser on THIS home's photos, the chosen song, look, words and shape. The shot
// list comes from the same planner the final video uses (/fast-preview: no AI, nothing saved, free), so
// the cuts land on the song's beats. Before the AI editor has looked at the photos the order is the
// planner's own (room by room); the made video uses the AI editor's picks.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Player } from '@remotion/player'
import { FastFilm, type FastProps } from '@/motion-video/FastFilm'
import { FPS } from '@/motion-video/types'
import { previewSize, sized, type MotionSettings } from '@/lib/studio/cinematic'
import { api } from '@/lib/api-service'

// the last plan per project: moving between steps shows it straight away (then refreshes if anything changed)
const LAST = new Map<string, { props: FastProps; exact: boolean; sig: string }>()

const KEYS = ['theme', 'accent', 'metal', 'situation', 'copy', 'facts', 'sections', 'agent', 'format', 'length', 'song', 'fast'] as const

export default function FastLivePreview({ id, settings, maxH, onExample }: {
  id: string
  settings: MotionSettings
  maxH?: string
  /** Opens the finished example (a real made Fast Cut). */
  onExample?: () => void
}) {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const q = () => setPhone(window.innerWidth < 640)
    q(); window.addEventListener('resize', q)
    return () => window.removeEventListener('resize', q)
  }, [])

  // only what changes the video asks for a new plan (a typed word waits for the agent to pause)
  const body = useMemo(() => {
    const m: Record<string, unknown> = {}
    for (const k of KEYS) m[k] = (settings as unknown as Record<string, unknown>)[k]
    m.photos = settings.photos
    return m
  }, [settings])
  const sig = useMemo(() => JSON.stringify([body, settings.photos.map(p => [p.id, p.hidden])]), [body, settings.photos])
  const [raw, setRaw] = useState<FastProps | null>(() => LAST.get(id)?.props ?? null)
  const [exact, setExact] = useState(() => !!LAST.get(id)?.exact)
  const [state, setState] = useState<'loading' | 'ok' | 'few' | 'error'>(() => (LAST.get(id) ? 'ok' : 'loading'))
  const seq = useRef(0)
  useEffect(() => {
    if (LAST.get(id)?.sig === sig && raw) return
    const n = ++seq.current
    const t = setTimeout(() => {
      api.mediaLab.motion.fastPreview(id, body).then(r => {
        if (n !== seq.current) return
        if (r.success && r.data?.props) { setRaw(r.data.props); setExact(!!r.data.exact); setState('ok'); LAST.set(id, { props: r.data.props, exact: !!r.data.exact, sig }) }
        else setState(/needs at least/i.test(r.error || '') ? 'few' : 'error')
      }).catch(() => { if (n === seq.current) setState('error') })
    }, raw ? 700 : 150)
    return () => clearTimeout(t)
  }, [sig]) // eslint-disable-line react-hooks/exhaustive-deps

  // same-origin, smaller photos (the preview draws at half size; phones at a third)
  const props = useMemo<FastProps | null>(() => {
    if (!raw) return null
    const brand = raw.brand ? { ...raw.brand, agent: raw.brand.agent ? { ...raw.brand.agent, photo: sized(raw.brand.agent.photo, 256, 80) || undefined } : raw.brand.agent } : raw.brand
    return {
      ...raw,
      format: settings.format,
      preview: true,
      brand: brand as FastProps['brand'],
      shots: raw.shots.map(sh => ({
        ...sh,
        src: sized(sh.src, 1200, 80) || sh.src,
        depth: sized(sh.depth, 1080, 90),
        duskSrc: sh.duskSrc ? sized(sh.duskSrc, 1200, 80) : sh.duskSrc,
      })),
    }
  }, [raw, settings.format])
  const { w, h } = previewSize(settings.format, phone)
  const frames = props ? Math.max(FPS, Math.round(props.duration * FPS)) : FPS
  const box = { aspectRatio: `${w} / ${h}`, width: maxH ? `min(100%, calc(${maxH} * ${(w / h).toFixed(4)}))` : undefined }

  return (
    <div className="space-y-2" data-testid="fast-live-preview">
      <div className="relative mx-auto overflow-hidden rounded-2xl bg-black shadow-xl" style={box}>
        {props ? (
          <Player
            key={`${settings.format}-${frames}`}
            component={FastFilm as never}
            inputProps={props as never}
            durationInFrames={frames}
            initialFrame={Math.min(frames - 1, Math.round(1.2 * FPS))}
            fps={FPS}
            compositionWidth={w}
            compositionHeight={h}
            style={{ width: '100%', height: '100%' }}
            controls
            loop
            clickToPlay
            doubleClickToFullscreen
            allowFullscreen
            showVolumeControls
            acknowledgeRemotionLicense
          />
        ) : state === 'loading' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="ohp-flp-shim absolute inset-0" />
            <span className="relative rounded-full bg-black/55 px-3 py-1 text-[11px] font-black text-white/85">Lining your photos up with the beat…</span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center">
            <p className="text-sm font-black text-white">{state === 'few' ? 'Pick at least 8 photos to see your Fast Cut' : 'The preview couldn\'t load just now'}</p>
            {onExample && <button type="button" onClick={onExample} className="rounded-full bg-white px-4 py-1.5 text-xs font-black text-[#111827]">Watch a finished example</button>}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-1 text-[11px] font-bold text-gray-400">
        <span className="truncate">{props ? `Live preview · ${props.shots.length} shots · ${Math.round(props.duration)} sec · free` : 'Live preview · free'}</span>
        {onExample && <button type="button" onClick={onExample} className="inline-flex shrink-0 items-center gap-1 font-black text-[#B8902F] hover:underline dark:text-[#E8C98A]" data-testid="fast-example-open">▶ Example</button>}
      </div>
      {props && !exact && (
        <p className="px-1 text-[11px] font-semibold text-gray-400">A quick sketch on your photos. On <b>Your shots</b> the AI editor sets the real order - from then on this preview plays exactly the video you&apos;ll get.</p>
      )}
      <style>{`.ohp-flp-shim{background:linear-gradient(110deg,#1b1b1f 30%,#2a2a30 50%,#1b1b1f 70%);background-size:220% 100%;animation:ohpFlp 1.4s linear infinite}@keyframes ohpFlp{to{background-position:-120% 0}}`}</style>
    </div>
  )
}
