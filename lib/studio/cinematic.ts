// AI Media "Cinematic Video" - the editor's side: the saved project settings (options.motion on the
// StudioMediaAsset), and turning them into the video's props for the live preview player. The
// video itself lives in /remotion (shared with the render worker).
import type { StudioMediaAsset } from '@/types'
import { pimg } from '@/lib/photoUrl'
import { ROOM_OPTIONS, type RoomKey } from '@/motion-video/presets'
import { maxPhotosFor } from '@/motion-video/timeline'
import type {
  CameraMove, MotionAgentInfo, MotionCopy, MotionFacts, MotionFormat, MotionMetal, MotionMusic, MotionProps,
  MotionSections, MotionSituation, MotionStyleId, MotionTheme, PhotoKind, TransitionId,
} from '@/motion-video/types'

export type MotionPhotoSetting = {
  id: string
  source: string
  clean?: string | null
  depth?: string | null
  sharp?: string | null
  kind: PhotoKind
  label: string
  kicker: string
  showLabel: boolean
  move: CameraMove
  focusX: number
  lights: boolean
  water: boolean
  sky: boolean
  trees: boolean
  fire?: boolean
  fireBox?: number[] | null
  sharpDepth?: boolean
  transitionIn?: TransitionId | null
  hidden: boolean
  analyzed: boolean
  sure: boolean
  confirmed: boolean
  room?: RoomKey | 'skip' | null
  prep_failed?: boolean
}

/** One photo the project may use (all of the listing's, or the agent's uploads), sorted into a room
 *  by the AI. Server-owned: the editor only reads it. */
export type MotionPoolPhoto = {
  source: string
  room: RoomKey | 'skip' | null
  kind: PhotoKind
  label: string
  kicker: string
  sure: boolean
  score: number
  focusX: number
  lights: boolean
  water: boolean
  sky: boolean
  trees: boolean
  fire?: boolean
  fireBox?: number[] | null
  analyzed: boolean
  clean?: string | null
  depth?: string | null
  sharp?: string | null
  sharpDepth?: boolean
}

export type MotionSettings = {
  photos: MotionPhotoSetting[]
  pool?: MotionPoolPhoto[]
  /** The rooms the agent chose to show (step 2), in walk-through order. */
  want?: RoomKey[]
  /** Seconds: 15 / 30 / 45 / 60. */
  length?: number | null
  theme: MotionTheme
  accent: string
  metal: MotionMetal
  style: MotionStyleId
  transition: TransitionId
  situation: MotionSituation
  copy: MotionCopy
  facts: MotionFacts
  agent: MotionAgentInfo
  sections: MotionSections
  music: MotionMusic
  format: MotionFormat
  sharpen: boolean
  ordered_by_ai?: boolean
}

export type MotionRender = {
  state: 'idle' | 'preparing' | 'queued' | 'rendering' | 'finishing' | 'done' | 'failed'
  progress?: number
  stage?: string
  started_at?: string
  finished_at?: string
  seconds?: number
  error?: string
  target?: MotionFormat
  main?: boolean
  hash?: string
  /** Videos the video maker makes before this one (owner 11/12: agents see their place in line). */
  ahead?: number
  /** When it should be ready (from the video maker's measured speed) - the page counts down to it. */
  eta_at?: string | null
  /** The video maker has timed real videos (false = still its first guess). */
  eta_learned?: boolean
}

/** "4:05" - a countdown clock. */
export const clock = (secs: number) => {
  const s = Math.max(0, Math.round(secs))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export type MotionAnalysis = { status: 'idle' | 'running' | 'done' | 'failed'; done?: number; total?: number; step?: string; error?: string; cost_usd?: number }

export const settingsOf = (a?: StudioMediaAsset | null): MotionSettings | null => ((a?.options as any)?.motion as MotionSettings) || null
export const renderOf = (a?: StudioMediaAsset | null): MotionRender => ((a?.options as any)?.render as MotionRender) || { state: 'idle' }
export const analysisOf = (a?: StudioMediaAsset | null): MotionAnalysis => ((a?.options as any)?.analysis as MotionAnalysis) || { status: 'idle' }
export const formatsOf = (a?: StudioMediaAsset | null): Record<string, { url: string; hash?: string }> => ((a?.options as any)?.formats as any) || {}
export const RENDER_ACTIVE = ['preparing', 'queued', 'rendering', 'finishing']

/** Same-origin copy of a photo (WebGL can only read images that are). */
export const proxied = (url?: string | null) => (!url ? null : url.startsWith('/') ? url : `/api/pdf-image?url=${encodeURIComponent(url)}`)

/** A resized copy through /pimg - same-origin (WebGL can read it) and kept by Cloudflare after the
 *  first viewer, so a thousand agents previewing costs our server next to nothing. */
export const sized = (url: string | null | undefined, w: number, q = 80) => (!url ? null : url.startsWith('/') ? url : pimg(url, w, q))
export const thumbOf = (url?: string | null) => sized(url, 384, 70)
// Widths and qualities must be ones next.config.js allows (images.qualities, Next's standard sizes).

/** The props for the live preview - lighter renderer, same-origin photos, smaller canvas. */
export function previewProps(s: MotionSettings): MotionProps {
  return {
    photos: s.photos.map(p => ({
      id: p.id,
      src: sized(p.clean || p.source, 1200, 80) || p.source,
      depth: sized(p.depth, 1080, 90),
      kind: p.kind, label: p.label, kicker: p.kicker, showLabel: p.showLabel, move: p.move,
      focusX: p.focusX, lights: p.lights, water: p.water, sky: p.sky, trees: p.trees, fire: p.fire, fireBox: p.fireBox ?? null, sharpDepth: !!p.sharpDepth,
      transitionIn: p.transitionIn ?? null, hidden: p.hidden,
    })),
    theme: s.theme, accent: s.accent, metal: s.metal, style: s.style, transition: s.transition,
    situation: s.situation, copy: s.copy || {}, facts: s.facts, sections: s.sections, music: s.music,
    format: s.format, length: s.length ?? null,
    agent: { ...s.agent, photo: sized(s.agent?.photo, 256, 80) },
    preview: true,
  }
}

/** Preview canvas size: the composition is drawn at this size and scaled to fit (phones stay smooth). */
export function previewSize(format: MotionFormat, small = false): { w: number; h: number } {
  const k = small ? 0.33 : 0.5
  switch (format) {
    case '9:16': return { w: Math.round(1080 * k), h: Math.round(1920 * k) }
    case '1:1': return { w: Math.round(1080 * k), h: Math.round(1080 * k) }
    case '4:5': return { w: Math.round(1080 * k), h: Math.round(1350 * k) }
    default: return { w: Math.round(1920 * k), h: Math.round(1080 * k) }
  }
}

/** Fingerprint of what the video looks like (matches the backend's settings_hash closely enough
 *  to say "you have changes that aren't in your video yet"). */
export function lookKey(s: MotionSettings): string {
  const { photos, ordered_by_ai: _o, ...rest } = s
  return JSON.stringify([rest, photos.map(({ confirmed: _c, sure: _s, analyzed: _a, clean: _cl, depth: _d, sharp: _sh, ...p }) => p)])
}

// ---------------------------------------------------------------- rooms -> photos

const ROOM_RANK = new Map(ROOM_OPTIONS.map((r, i) => [r.id, i]))
/** How many photos sit well in each length (a few more than the rooms picked, when the house has them). */
const TARGET: Record<number, number> = { 15: 4, 30: 7, 45: 10, 60: 13 }
export const targetPhotosFor = (length?: number | null) => TARGET[length || 30] ?? 7

/** The rooms this listing actually has photos of, best first inside each room. */
export function roomsInPool(pool: MotionPoolPhoto[] = []): { id: RoomKey; photos: MotionPoolPhoto[] }[] {
  const by = new Map<RoomKey, MotionPoolPhoto[]>()
  for (const it of pool) {
    if (!it.analyzed || !it.room || it.room === 'skip') continue
    by.set(it.room, [...(by.get(it.room) || []), it])
  }
  return ROOM_OPTIONS.filter(r => by.has(r.id)).map(r => ({ id: r.id, photos: [...by.get(r.id)!].sort((a, b) => b.score - a.score) }))
}

/** What we suggest showing for this length: the strongest rooms first (front of the home always). */
export function suggestRooms(pool: MotionPoolPhoto[] = [], length?: number | null): RoomKey[] {
  const rooms = roomsInPool(pool)
  const max = maxPhotosFor(length)
  const must: RoomKey[] = ['front', 'kitchen', 'living', 'primary', 'pool', 'yard', 'aerial']
  // a must-have room only when its best photo is actually good (an empty bedroom shot of doors and a
  // hallway shouldn't beat a strong photo of another room); the front of the home always stays
  // (scores are 0.5-5.5: the AI's 1-10 halved - 3.5 = a 7/10 photo)
  const strong = (r: { id: RoomKey; photos: MotionPoolPhoto[] }) => r.id === 'front' || (r.photos[0]?.score || 0) >= 3.5
  const ranked = [...rooms].sort((a, b) => {
    const ma = strong(a) ? must.indexOf(a.id) : -1, mb = strong(b) ? must.indexOf(b.id) : -1
    if ((ma >= 0) !== (mb >= 0)) return ma >= 0 ? -1 : 1
    if (ma >= 0 && mb >= 0) return ma - mb
    return (b.photos[0]?.score || 0) - (a.photos[0]?.score || 0)
  })
  // variety: a second bathroom or bedroom only when nothing else is left (5 rooms with two baths in
  // them looked thin - owner 11/12)
  const kindOf = (id: RoomKey) => ROOM_OPTIONS.find(o => o.id === id)?.kind
  const first: RoomKey[] = [], later: RoomKey[] = []
  for (const r of ranked) {
    const k = kindOf(r.id)
    const dup = (k === 'bathroom' || k === 'bedroom') && first.some(id => kindOf(id) === k)
    ;(dup ? later : first).push(r.id)
  }
  const pick = [...first, ...later].slice(0, Math.min(max, Math.max(2, targetPhotosFor(length) - 1)))
  return pick.sort((a, b) => (ROOM_RANK.get(a) ?? 99) - (ROOM_RANK.get(b) ?? 99))
}

const newId = () => Math.random().toString(36).slice(2, 12).padEnd(10, '0')

function fromPool(it: MotionPoolPhoto, keep?: MotionPhotoSetting): MotionPhotoSetting {
  if (keep && keep.source === it.source) return keep
  return {
    id: newId(), source: it.source, clean: it.clean ?? null, depth: it.depth ?? null, sharp: it.sharp ?? null, sharpDepth: !!it.sharpDepth,
    kind: it.kind, label: it.label, kicker: it.kicker, showLabel: true, move: 'auto', focusX: it.focusX,
    lights: it.lights, water: it.water, sky: it.sky, trees: it.trees, fire: it.fire, fireBox: it.fireBox ?? null, transitionIn: null, hidden: false,
    analyzed: it.analyzed, sure: it.sure, confirmed: false, room: it.room,
  }
}

/** The video's photos for these rooms and this length (our suggestion, and "Our pick"): the best photo
 *  of each room first, then (when a room has more good ones and the length has time) a second, all in
 *  walk-through order. Photos the agent already checked or edited are kept as they are.
 *  11/13 fix: every wanted room's first photo is placed BEFORE any second photo is - the cut to the
 *  length used to happen before sorting, so a newly tapped room (the patio) fell off the end while a
 *  second photo of another room filled its place. */
export function photosForRooms(s: MotionSettings, want: RoomKey[], length?: number | null): MotionPhotoSetting[] {
  const pool = s.pool || []
  const max = maxPhotosFor(length)
  const target = Math.min(max, targetPhotosFor(length))
  const rooms = roomsInPool(pool).filter(r => want.includes(r.id))
  const existing = new Map(s.photos.map(p => [p.source, p]))
  const firsts: { it: MotionPoolPhoto; room: RoomKey }[] = []
  const seconds: { it: MotionPoolPhoto; room: RoomKey }[] = []
  const used = new Set<string>()
  for (const r of rooms) {
    // the agent's own (visible) picks in this room come first, then our best
    const mine = s.photos.filter(p => !p.hidden && r.photos.some(x => x.source === p.source))
      .map(p => r.photos.find(x => x.source === p.source)!)
    const order = [...mine, ...r.photos.filter(x => !mine.includes(x))]
    const one = order.find(x => !used.has(x.source))
    if (!one) continue
    firsts.push({ it: one, room: r.id }); used.add(one.source)
    const two = order.find(x => !used.has(x.source) && (mine.includes(x) || x.score >= 3))
    if (two) seconds.push({ it: two, room: r.id })
  }
  seconds.sort((a, b) => b.it.score - a.it.score)
  const chosen = firsts.slice(0, max)
  for (const e of seconds) {
    if (chosen.length >= target) break
    chosen.push(e) // each photo belongs to one room, so a second never repeats another room's photo
  }
  return chosen
    .sort((a, b) => (ROOM_RANK.get(a.room) ?? 99) - (ROOM_RANK.get(b.room) ?? 99) || b.it.score - a.it.score)
    .map(c => fromPool(c.it, existing.get(c.it.source)))
}

// ---------------------------------------------------------------- sections + picking single photos

/** One group of photos on "What to show": a room the AI found, or "Other photos" (floor plans,
 *  garages, closets and anything it couldn't place - still offered, owner 11/13: every photo must be
 *  reachable). Best photo first. */
export type PhotoSection = { id: RoomKey | 'other'; label: string; photos: MotionPoolPhoto[] }
export function sectionsOf(pool: MotionPoolPhoto[] = []): PhotoSection[] {
  const rooms: PhotoSection[] = roomsInPool(pool).map(r => ({ id: r.id, label: ROOM_OPTIONS.find(o => o.id === r.id)?.label || r.id, photos: r.photos }))
  const known = new Set(rooms.flatMap(r => r.photos.map(p => p.source)))
  const other = pool.filter(it => it.analyzed && !known.has(it.source)).sort((a, b) => b.score - a.score)
  return other.length ? [...rooms, { id: 'other', label: 'Other photos', photos: other }] : rooms
}

/** The video's photos (shown ones only) that come from this section. */
export const pickedIn = (s: MotionSettings, sec: PhotoSection) => {
  const srcs = new Set(sec.photos.map(p => p.source))
  return s.photos.filter(p => !p.hidden && srcs.has(p.source))
}

/** The rooms that have a photo in the video, in walk-through order (kept as `want` for the server). */
export const wantOf = (photos: MotionPhotoSetting[], pool: MotionPoolPhoto[] = []): RoomKey[] => {
  const room = new Map(pool.map(it => [it.source, it.room]))
  const out = new Set<RoomKey>()
  for (const p of photos) {
    const r = (room.get(p.source) ?? p.room) as string | null | undefined
    if (!p.hidden && r && r !== 'skip' && ROOM_RANK.has(r as RoomKey)) out.add(r as RoomKey)
  }
  return Array.from(out).sort((a, b) => (ROOM_RANK.get(a) ?? 99) - (ROOM_RANK.get(b) ?? 99))
}

const rankOf = (room?: string | null) => (room && ROOM_RANK.has(room as RoomKey) ? ROOM_RANK.get(room as RoomKey)! : 98)

/** Ticks one photo in (or back in, keeping its checked caption when it was only taken out). It goes
 *  after the last photo of its room - or where its room sits in the walk-through. */
export function addPhoto(s: MotionSettings, it: MotionPoolPhoto): MotionPhotoSetting[] {
  const had = s.photos.find(p => p.source === it.source)
  if (had) return s.photos.map(p => (p.id === had.id ? { ...p, hidden: false } : p))
  const add = fromPool(it)
  const r = rankOf(it.room)
  const photos = [...s.photos]
  let at = -1
  photos.forEach((p, i) => { if (rankOf(p.room) <= r) at = i })
  photos.splice(at + 1, 0, add)
  return photos
}

/** Unticks one photo: it leaves the video (its files stay with the project, so it can come back). */
export const removePhoto = (s: MotionSettings, source: string): MotionPhotoSetting[] => s.photos.filter(p => p.source !== source)

/** A shorter length holds fewer photos: drop the weakest extras first (a room's second photo), then
 *  the weakest photo overall. Taken-out photos don't count. */
export function trimToCap(s: MotionSettings, cap: number): MotionPhotoSetting[] {
  let photos = [...s.photos]
  const score = new Map((s.pool || []).map(it => [it.source, it.score]))
  const roomOf = (p: MotionPhotoSetting) => (s.pool || []).find(it => it.source === p.source)?.room ?? p.room
  while (photos.filter(p => !p.hidden).length > cap) {
    const vis = photos.filter(p => !p.hidden)
    const count = new Map<string, number>()
    vis.forEach(p => count.set(String(roomOf(p)), (count.get(String(roomOf(p))) || 0) + 1))
    const extras = vis.filter(p => (count.get(String(roomOf(p))) || 0) > 1)
    const from = extras.length ? extras : vis.filter(p => roomOf(p) !== 'front').length ? vis.filter(p => roomOf(p) !== 'front') : vis
    const drop = from.reduce((a, b) => ((score.get(b.source) ?? 3) < (score.get(a.source) ?? 3) ? b : a))
    photos = photos.filter(p => p !== drop)
  }
  return photos
}

/** "Try another" on the check step: walks through EVERY photo of this photo's room, one after another,
 *  and round again (11/13 fix: it swapped between the same two - the photo it had just replaced went
 *  back to the top of the list each time). A room with only this photo offers the other unused ones. */
export function cycleChoice(s: MotionSettings, photo: MotionPhotoSetting): { next: MotionPoolPhoto | null; at: number; total: number } {
  const pool = (s.pool || []).filter(it => it.analyzed)
  const room = pool.find(it => it.source === photo.source)?.room ?? photo.room ?? null
  const others = new Set(s.photos.filter(p => !p.hidden && p.id !== photo.id).map(p => p.source))
  const sameRoom = (r: MotionPoolPhoto['room']) => (room && room !== 'skip' ? r === room : !r || r === 'skip')
  const list = pool.filter(it => sameRoom(it.room) && (it.source === photo.source || !others.has(it.source))).sort((a, b) => b.score - a.score)
  if (!list.some(it => it.source === photo.source)) {
    return { next: list[0] ?? pool.find(it => !others.has(it.source) && it.source !== photo.source) ?? null, at: 0, total: list.length }
  }
  if (list.length > 1) {
    const i = list.findIndex(it => it.source === photo.source)
    return { next: list[(i + 1) % list.length], at: i + 1, total: list.length }
  }
  const rest = pool.filter(it => it.room !== 'skip' && !others.has(it.source) && it.source !== photo.source).sort((a, b) => b.score - a.score)
  return { next: rest[0] ?? null, at: 1, total: 1 }
}

/** Puts a pool photo in place of one in the video (same spot, same transition). Any taken-out copy of
 *  the new photo goes, so a photo is never in the list twice. */
export function swapPhoto(s: MotionSettings, photoId: string, it: MotionPoolPhoto): MotionPhotoSetting[] {
  return s.photos
    .filter(p => p.id === photoId || p.source !== it.source)
    .map(p => (p.id === photoId ? { ...fromPool(it), showLabel: p.showLabel, move: 'auto' as const, transitionIn: p.transitionIn ?? null } : p))
}

export const pct = (v?: number | null) => (v == null ? null : v < 1 ? '<1%' : `${Math.round(v)}%`)

export function newRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
