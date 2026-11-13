'use client'

// The real video, playing live in the browser from the current settings (@remotion/player) -
// every edit shows instantly, nothing renders on a server, nothing costs anything. It draws at a
// reduced size with a lighter renderer so phones keep up; the final render is full quality.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { MotionFilm } from '@/motion-video/MotionFilm'
import { buildTimeline } from '@/motion-video/timeline'
import { FPS, type MotionProps } from '@/motion-video/types'
import { previewProps, previewSize, targetPhotosFor, type MotionSettings } from '@/lib/studio/cinematic'
import { SAMPLE_EXTRA, SAMPLE_PHOTOS } from '@/motion-video/sample'

export default function LivePreview({ settings, props: rawProps, autoPlay = false, loop = true, className = '', seekToSecond, rounded = true, small: forceSmall, maxH }: {
  settings?: MotionSettings
  /** Ready-made props (the example) instead of a project's settings. */
  props?: MotionProps
  autoPlay?: boolean
  loop?: boolean
  className?: string
  seekToSecond?: number | null
  rounded?: boolean
  small?: boolean
  /** Tallest the player may be (CSS length) - it narrows to keep its shape. */
  maxH?: string
}) {
  const ref = useRef<PlayerRef>(null)
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const q = () => setPhone(window.innerWidth < 640)
    q(); window.addEventListener('resize', q)
    return () => window.removeEventListener('resize', q)
  }, [])
  // Before any rooms are picked, the project's own look plays on the example photos.
  const example = !rawProps && !!settings && !settings.photos.some(p => !p.hidden)
  const props = useMemo(() => {
    if (rawProps) return { ...rawProps, preview: true }
    const p = previewProps(settings!)
    return example ? { ...p, photos: [...SAMPLE_PHOTOS, ...SAMPLE_EXTRA].slice(0, Math.max(3, Math.min(6, targetPhotosFor(settings!.length)))) } : p
  }, [rawProps, settings, example])
  const frames = useMemo(() => buildTimeline(props).frames, [props])
  const { w, h } = previewSize(props.format, forceSmall ?? phone)

  useEffect(() => {
    if (seekToSecond == null || !ref.current) return
    ref.current.seekTo(Math.max(0, Math.min(frames - 1, Math.round(seekToSecond * FPS))))
  }, [seekToSecond, frames])

  return (
    <div className={`relative mx-auto overflow-hidden bg-black ${rounded ? 'rounded-2xl' : ''} ${className}`}
      style={{ aspectRatio: `${w} / ${h}`, width: maxH ? `min(100%, calc(${maxH} * ${(w / h).toFixed(4)}))` : undefined }}>
      {example && <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/85">Example photos until you pick your rooms</span>}
      <Player
        ref={ref}
        component={MotionFilm as never}
        inputProps={props as never}
        durationInFrames={frames}
        initialFrame={Math.min(frames - 1, Math.round(2.6 * FPS))}
        fps={FPS}
        compositionWidth={w}
        compositionHeight={h}
        style={{ width: '100%', height: '100%' }}
        controls
        loop={loop}
        autoPlay={autoPlay}
        initiallyMuted={autoPlay}
        clickToPlay
        doubleClickToFullscreen
        allowFullscreen
        showVolumeControls
        acknowledgeRemotionLicense
      />
    </div>
  )
}
