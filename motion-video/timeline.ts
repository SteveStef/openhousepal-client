// When everything happens: each photo's shot, the transitions between them, the opening title,
// the captions, the stats and the closing card. Pure maths on the props, used by the video, the
// preview player (length) and the editor (the timeline strip).
import { stylePreset, transitionPreset } from './presets'
import type { MotionPhoto, MotionProps, TransitionId } from './types'
import { FPS } from './types'

export type ShotTiming = {
  photo: MotionPhoto
  index: number          // position among the visible photos
  start: number          // seconds - first frame this shot is on screen
  end: number            // seconds - last moment it is on screen (incl. the transition out)
  /** The transition into this shot and how long it overlaps the previous one. */
  inTransition: TransitionId
  inSeconds: number
  outTransition: TransitionId
  outSeconds: number
  /** Shading painted into this photo for the words on it (opening title, caption or stats). */
  scrim: 'opening' | 'caption' | 'stats' | null
}

export type CaptionTiming = { photoId: string; start: number; end: number }

export type Timeline = {
  shots: ShotTiming[]
  captions: CaptionTiming[]
  opening: { start: number; end: number } | null
  stats: { start: number; end: number } | null
  endCard: { start: number; end: number } | null
  agentBadge: { start: number; end: number } | null
  duration: number
  frames: number
}

const END_CARD_SECONDS = 4.4
const END_CARD_OVERLAP = 1.0
const STATS_SECONDS = 4.4
/** Shortest / longest a room may stay on screen when the video is fitted to a chosen length. */
// Owner 11/12: rooms flashed by too fast at ~3 s each - every room now gets ~5-6 s on screen.
const SHOT_MIN = 3.8
const SHOT_MAX = 7.5

/** The lengths an agent can pick, and how many photos fit each (more would flash by too fast). */
export const LENGTH_OPTIONS: { seconds: number; maxPhotos: number; label: string; hint: string }[] = [
  { seconds: 15, maxPhotos: 3, label: '15 sec', hint: 'Quick teaser · up to 3 photos' },
  { seconds: 30, maxPhotos: 5, label: '30 sec', hint: 'Reels & stories · up to 5 photos' },
  { seconds: 45, maxPhotos: 7, label: '45 sec', hint: 'Fuller tour · up to 7 photos' },
  { seconds: 60, maxPhotos: 9, label: '60 sec', hint: 'Full tour · up to 9 photos' },
]
export const maxPhotosFor = (seconds?: number | null) =>
  (LENGTH_OPTIONS.find(o => o.seconds === seconds) || LENGTH_OPTIONS.find(o => (seconds || 30) <= o.seconds) || LENGTH_OPTIONS[LENGTH_OPTIONS.length - 1]).maxPhotos

/** Each photo's screen time. With a chosen length, the rooms share the time left after the opening,
 *  stats and closing card; without one, the style's own pace. */
function shotLengths(n: number, style: ReturnType<typeof stylePreset>, opening: boolean, stats: boolean, endCard: boolean, length?: number | null): number[] {
  const short = !!length && length <= 20
  const minFirst = opening ? (short ? 4.2 : 5.2) : 0
  const minLast = stats ? (short ? 4.2 : STATS_SECONDS + 0.6) : 0
  if (!length || n === 0) {
    return Array.from({ length: n }, (_, i) => {
      let len = i === 0 ? style.first : style.shot
      if (i === 0) len = Math.max(len, minFirst)
      if (i === n - 1) len = Math.max(len, minLast)
      return len
    })
  }
  const body = Math.max(3, length - (endCard ? END_CARD_SECONDS - END_CARD_OVERLAP : 0))
  const mins = Array.from({ length: n }, (_, i) => Math.max(i === 0 ? minFirst : 0, i === n - 1 ? minLast : 0))
  // Share the time equally, but never below a photo's minimum: fix those first, split the rest.
  const fixed: boolean[] = mins.map(() => false)
  let each = body / n
  for (let pass = 0; pass < n; pass++) {
    const free = fixed.filter(f => !f).length
    const used = mins.reduce((a, m, i) => a + (fixed[i] ? m : 0), 0)
    each = free ? (body - used) / free : 0
    const grow = mins.findIndex((m, i) => !fixed[i] && m > each)
    if (grow < 0) break
    fixed[grow] = true
  }
  const s = Math.min(SHOT_MAX, Math.max(SHOT_MIN, each))
  return mins.map((m, i) => (fixed[i] ? m : Math.max(m, s)))
}

export function buildTimeline(props: Pick<MotionProps, 'photos' | 'style' | 'transition' | 'sections' | 'situation' | 'facts' | 'length'>): Timeline {
  const style = stylePreset(props.style)
  const visible = props.photos.filter(p => !p.hidden)
  const sec = props.sections
  const pos = (v?: string) => !!v && Number(String(v).replace(/[^0-9.]/g, '')) > 0 // "0" facts are left off (Overlays)
  const hasStats = sec.stats && [props.facts.beds, props.facts.baths, props.facts.sqft, props.facts.acres].some(pos)
  const lens = shotLengths(visible.length, style, sec.opening, hasStats, sec.endCard, props.length)
  const shots: ShotTiming[] = []
  let t = 0
  visible.forEach((photo, i) => {
    const inT: TransitionId = i === 0 ? 'cut' : (photo.transitionIn || props.transition)
    const inS = i === 0 ? 0 : transitionPreset(inT).seconds
    const len = lens[i]
    const start = Math.max(0, t - inS)
    const end = start + len + inS
    shots.push({ photo, index: i, start, end, inTransition: inT, inSeconds: inS, outTransition: 'cut', outSeconds: 0, scrim: null })
    t = end
  })
  for (let i = 0; i < shots.length - 1; i++) {
    shots[i].outTransition = shots[i + 1].inTransition
    shots[i].outSeconds = shots[i + 1].inSeconds
  }
  const lastEnd = shots.length ? shots[shots.length - 1].end : 0

  const opening = sec.opening && shots.length ? { start: 0, end: Math.min(shots[0].end - 0.2, 5.4) } : null
  const captions: CaptionTiming[] = []
  if (sec.labels) {
    shots.forEach((s, i) => {
      if (!s.photo.showLabel || !(s.photo.label || '').trim()) return
      if (i === 0 && opening) return
      if (i === shots.length - 1 && hasStats) return
      // the words may start halfway into the fade-in and stay until just into the fade-out (they fade
      // with their room) - waiting for each fade to finish dropped every caption in short videos
      const a = s.start + s.inSeconds * 0.5 + 0.25
      const b = s.end - Math.max(0.25, s.outSeconds * 0.6)
      if (b - a >= 1.5) { captions.push({ photoId: s.photo.id, start: a, end: b }); s.scrim = 'caption' }
    })
  }
  const stats = hasStats && shots.length ? { start: Math.max(shots[shots.length - 1].start + 0.4, lastEnd - STATS_SECONDS - 0.2), end: lastEnd - 0.1 } : null
  if (opening && shots.length) shots[0].scrim = 'opening'
  if (stats) shots[shots.length - 1].scrim = 'stats'

  let duration = lastEnd
  let endCard: Timeline['endCard'] = null
  if (sec.endCard && shots.length) {
    endCard = { start: lastEnd - END_CARD_OVERLAP, end: lastEnd - END_CARD_OVERLAP + END_CARD_SECONDS }
    duration = endCard.end
  }
  if (!shots.length) duration = 3
  const agentBadge = sec.agent === 'off' || !shots.length ? null
    : sec.agent === 'opening' ? { start: 0.6, end: Math.min(shots[0].end, 6) }
    : { start: 0.6, end: endCard ? endCard.start : duration }
  const frames = Math.max(FPS, Math.round(duration * FPS))
  return { shots, captions, opening, stats, endCard, agentBadge, duration, frames }
}
