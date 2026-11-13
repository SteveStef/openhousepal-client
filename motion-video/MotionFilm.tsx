// The Cinematic Video itself: each photo is one real camera move through its 3D depth, joined by
// the chosen transitions, with the opening title, room captions, stats, closing card and agent
// badge on top. Same component in the editor's live preview and in the final render.
import React from 'react'
import { AbsoluteFill, Audio, Easing, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { CinePhoto, SAFE_SHIFT_SHARP, type CineCam } from './CinePhoto'
import { AgentBadge, Caption, EndCard, LightLeak, OpeningTitle, ShotScrim, Stats, lookOf, useMotionFonts } from './Overlays'
import { isExteriorKind, resolveMove, stylePreset } from './presets'
import { buildTimeline, type ShotTiming } from './timeline'
import type { MotionPhoto, MotionProps } from './types'
import { musicFile } from './types'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, p: number) => a + (b - a) * p
const ss = Easing.bezier(0.42, 0, 0.58, 1)
const easeIn = (p: number) => p * p
const easeOut = (p: number) => 1 - (1 - p) * (1 - p)

// pan / tilt = the camera turning (degrees). Turning never warps anything - only moving the camera's
// position does, and that part is held back near close furniture (SAFE_SHIFT) - so the turns are what
// carry the "someone is filming this" feel.
type Pose = { x: number; y: number; z: number; pan?: number; tilt?: number }
type MovePlan = { from: Pose; to: Pose; look: number }

// Every move is centred on the spot the photo was taken from: the camera starts on one side of it and
// ends on the other. Same distance travelled, but it never strays more than half of it from the real
// viewpoint - and how far it strays is what makes close things (chairs, posts) warp, worst at the end
// of a shot. (The old moves started AT the viewpoint and ended a full move away, right as the next
// room faded in.)
function movePlan(move: ReturnType<typeof resolveMove>, scale: number, zFar: number, dir: number): MovePlan {
  const p = rawMovePlan(move, scale, zFar, dir)
  const c = { x: (p.from.x + p.to.x) / 2, y: (p.from.y + p.to.y) / 2, z: (p.from.z + p.to.z) / 2 }
  return {
    from: { ...p.from, x: p.from.x - c.x, y: p.from.y - c.y, z: p.from.z - c.z },
    to: { ...p.to, x: p.to.x - c.x, y: p.to.y - c.y, z: p.to.z - c.z },
    look: p.look,
  }
}

function rawMovePlan(move: ReturnType<typeof resolveMove>, scale: number, zFar: number, dir: number): MovePlan {
  // Owner 11/12: another 20% on the sideways moves only - their turns are small, so it costs almost
  // no extra zoom (push-ins and drone turns would need ~3% more zoom; they stay as they are).
  const k = scale * (move === 'slide_left' || move === 'slide_right' || move === 'orbit' ? 1.2 : 1)
  switch (move) {
    // A walk-in: forward with a slight sideways drift and a slow turn (owner 11/12: the straight push
    // read as a zoom, since the no-warp limit turns most of its forward travel into lens zoom; the
    // turn is pure rotation, which never warps).
    case 'push': return { from: { x: -0.025 * k * dir, y: 0.004, z: -0.01, pan: -1.6 * k * dir, tilt: 0.3 * k }, to: { x: 0.025 * k * dir, y: -0.004, z: 0.13 * k, pan: 1.6 * k * dir, tilt: -0.3 * k }, look: zFar * 0.5 }
    // slides track sideways while the camera keeps turning toward the room (a dolly shot)
    case 'slide_left': return { from: { x: 0.05 * k, y: 0, z: 0, pan: -0.7 * k }, to: { x: -0.05 * k, y: 0, z: 0.03 * k, pan: 0.7 * k }, look: zFar * 0.55 }
    case 'slide_right': return { from: { x: -0.05 * k, y: 0, z: 0, pan: 0.7 * k }, to: { x: 0.05 * k, y: 0, z: 0.03 * k, pan: -0.7 * k }, look: zFar * 0.55 }
    // a crane: the camera rises while tilting
    case 'rise': return { from: { x: 0, y: 0.045 * k, z: -0.01, tilt: 0.8 * k }, to: { x: -0.01 * k, y: -0.035 * k, z: 0.07 * k, tilt: -0.8 * k }, look: zFar * 0.5 }
    case 'orbit': return { from: { x: -0.05 * k, y: 0, z: 0, pan: 0.6 * k }, to: { x: 0.05 * k, y: 0, z: 0.02 * k, pan: -0.6 * k }, look: zFar * 0.42 }
    case 'drone': return { from: { x: -0.03 * k, y: 0.02 * k, z: -0.02, pan: -1.5 * k }, to: { x: 0.03 * k, y: -0.01 * k, z: 0.08 * k, pan: 1.5 * k }, look: zFar * 0.8 }
  }
}

// zNear = how close the nearest thing in the photo is to the lens. Kept a little back from 1 so
// close-up objects (a lantern, a lamp, a plant by the edge) don't swell and stretch as the camera moves.
function lensFor(p: MotionPhoto): { zNear: number; zFar: number; focus: number; aperture: number; focal: number } {
  switch (p.kind) {
    case 'aerial': return { zNear: 1.3, zFar: 5, focus: 0.4, aperture: 1.5, focal: 0.7 }
    case 'exterior': return { zNear: 1.9, zFar: 16, focus: 0.33, aperture: 2, focal: 0.6 }
    case 'pool':
    case 'outdoor': return { zNear: 1.7, zFar: 12, focus: 0.38, aperture: 2.2, focal: 0.6 }
    case 'detail': return { zNear: 1.15, zFar: 4, focus: 0.6, aperture: 8, focal: 0.62 }
    default: return { zNear: 1.3, zFar: 6.5, focus: 0.45, aperture: 5, focal: 0.6 }
  }
}

// A barely-there drift so a shot never looks frozen. Owner 11/12: tripled + quicker wobbles read as
// "bobbing around / camera wobble" - keep it this gentle; the "being filmed" feel comes from the
// smooth pans/tilts in each move, not from shake.
function float(t: number, seed: number) {
  const s = (f: number, ph: number) => Math.sin(t * f * Math.PI * 2 + seed * 1.7 + ph)
  return {
    x: 0.0018 * (s(0.23, 0) + 0.5 * s(0.61, 1.3)),
    y: 0.0014 * (s(0.19, 2.1) + 0.5 * s(0.53, 0.4)),
    yaw: 0.06 * (s(0.17, 0.9) + 0.4 * s(0.47, 2.2)),
    pitch: 0.05 * (s(0.21, 1.7) + 0.4 * s(0.43, 0.2)),
    roll: 0.04 * s(0.13, 3.1),
  }
}

/** Owner 11/12: "a bit more movement", then another 20% (1.2 x 1.2). The turns get all of it; the
 *  camera's travel is still held to the same no-warp limit near close furniture, so warping can't grow. */
const MOTION_BOOST = 1.44

const Shot: React.FC<{ shot: ShotTiming; props: MotionProps; t: number; W: number; H: number }> = ({ shot, props, t, W, H }) => {
  const style = stylePreset(props.style)
  const p = shot.photo
  const move = resolveMove(p, shot.index)
  const lens = lensFor(p)
  const plan = movePlan(move, style.moveScale * MOTION_BOOST, lens.zFar, shot.index % 2 === 0 ? 1 : -1)
  const span = Math.max(0.5, shot.end - shot.start)
  const prog0 = clamp01((t - shot.start) / span)
  // Eased: the camera glides in and settles as the shot ends, instead of still moving at full speed
  // while the next room fades in.
  const prog = 0.4 * prog0 + 0.6 * ss(prog0)
  let x = lerp(plan.from.x, plan.to.x, prog)
  const y = lerp(plan.from.y, plan.to.y, prog)
  const z = lerp(plan.from.z, plan.to.z, prog)
  const fl = float(t, shot.index)
  let opacity = 1
  let black = 0
  let streak: [number, number] = [0, 0]
  let radial = 0
  const shiftX = 0
  let extraYaw = 0
  let zoom = 1 // zoom-through is a LENS zoom - pushing the camera itself would warp close things

  // ---- transition in
  if (shot.inSeconds > 0) {
    const q = clamp01((t - shot.start) / shot.inSeconds)
    switch (shot.inTransition) {
      case 'crossfade':
      case 'light': opacity = ss(q); break
      case 'dip': opacity = q < 0.5 ? 0 : 1; black = q < 0.5 ? 1 : 1 - ss((q - 0.5) * 2); break
      case 'whip': {
        // A real fast pan: this shot arrives still swinging in from the left, blurred by speed.
        opacity = ss(clamp01((q - 0.3) / 0.4))
        extraYaw = -6 * (1 - easeOut(q))
        streak = [(1 - easeOut(q)) * 80, 0]
        break
      }
      case 'zoom': {
        opacity = clamp01((q - 0.15) / 0.4)
        zoom *= 1 + (1 - easeOut(q)) * 0.16
        radial = (1 - q) * 14
        break
      }
    }
  }
  // ---- transition out
  if (shot.outSeconds > 0) {
    const q = clamp01((t - (shot.end - shot.outSeconds)) / shot.outSeconds)
    if (q > 0) {
      switch (shot.outTransition) {
        case 'dip': black = Math.max(black, q < 0.5 ? ss(q * 2) : 1); break
        case 'whip': extraYaw += 6 * easeIn(q); streak = [streak[0] + easeIn(q) * 80, 0]; break
        case 'zoom': zoom *= 1 + easeIn(q) * 0.35; radial = Math.max(radial, easeIn(q) * 16); break
      }
    }
  }
  // ---- opening fade from black
  if (shot.index === 0) black = Math.max(black, 1 - ss(clamp01(t / 1.3)))

  const dz = Math.max(0.5, plan.look - z)
  x += fl.x
  const yaw = (Math.atan2(-x, dz) * 180) / Math.PI + lerp(plan.from.pan ?? 0, plan.to.pan ?? 0, prog) + fl.yaw + extraYaw
  const pitch = (Math.atan2(y, dz) * 180) / Math.PI + lerp(plan.from.tilt ?? 0, plan.to.tilt ?? 0, prog) + fl.pitch
  const ts = t - shot.start
  const lightsOn = shot.index === 0 && p.lights ? ss(clamp01((ts - 0.9) / 1.8)) : 1
  const exterior = isExteriorKind(p.kind)
  const cam: CineCam = {
    pos: [x, y + fl.y, z], yaw, pitch, roll: fl.roll,
    // crop 1 = the whole photo; CinePhoto adds only the zoom this shot's turns need (range)
    focal: lens.focal, crop: 1, zoom, zNear: lens.zNear, zFar: lens.zFar,
    range: {
      pan: Math.max(Math.abs(plan.from.pan ?? 0), Math.abs(plan.to.pan ?? 0)) + Math.max(Math.abs(plan.from.x), Math.abs(plan.to.x)) / Math.max(0.5, plan.look) * 57.3 + 0.12,
      tilt: Math.max(Math.abs(plan.from.tilt ?? 0), Math.abs(plan.to.tilt ?? 0)) + Math.max(Math.abs(plan.from.y), Math.abs(plan.to.y)) / Math.max(0.5, plan.look) * 57.3 + 0.1,
      x: Math.max(Math.abs(plan.from.x), Math.abs(plan.to.x)) + 0.003,
      y: Math.max(Math.abs(plan.from.y), Math.abs(plan.to.y)) + 0.003,
      back: Math.max(0, -Math.min(plan.from.z, plan.to.z)),
    },
    // Owner 11/12: "no blur - everything must be in stunning quality". No depth-of-field: the whole
    // photo stays sharp, front to back (lensFor's aperture is kept only as a record of the old look).
    focus: lens.focus, aperture: 0,
    time: t, lightsOn, flicker: p.lights ? (shot.index === 0 ? 1 : 0.4) : 0,
    lights: p.lights ? 1 : 0, water: p.water ? 1 : 0, sky: p.sky && exterior ? 1 : 0, sway: p.trees && exterior ? 1 : 0,
    fire: p.fire && p.fireBox ? 1 : 0, fireBox: p.fireBox ?? null,
    exposure: 1, focusX: p.focusX ?? 0.5, streak, radial, black,
    safe: props.safeShift || (p.sharpDepth ? SAFE_SHIFT_SHARP : undefined),
    travel: Math.max(Math.hypot(plan.from.x, plan.from.y, plan.from.z), Math.hypot(plan.to.x, plan.to.y, plan.to.z)),
  }
  return (
    <AbsoluteFill style={{ opacity, transform: shiftX ? `translateX(${shiftX}px)` : undefined }}>
      <CinePhoto src={p.src} depth={p.depth} W={W} H={H} cam={cam} preview={props.preview} perf={props.perf} />
      {shot.scrim && <ShotScrim kind={shot.scrim} luxe={props.theme === 'luxe'} tall={H > W * 1.1} />}
    </AbsoluteFill>
  )
}

export const MotionFilm: React.FC<MotionProps> = (props) => {
  useMotionFonts()
  const frame = useCurrentFrame()
  const { fps, width: W, height: H, durationInFrames } = useVideoConfig()
  const t = frame / fps
  const tl = buildTimeline(props)
  const look = lookOf(props, W, H)
  const bars = look.bar
  const dur = durationInFrames / fps
  const musicVol = (f: number) => interpolate(f / fps, [0, 1.2, Math.max(1.3, dur - 2.6), dur], [0, 0.85, 0.85, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const lastPhoto = tl.shots.length ? tl.shots[tl.shots.length - 1].photo : null
  const firstPhoto = tl.shots.length ? tl.shots[0].photo : null
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {tl.shots.map((s) => (t >= s.start && t < s.end ? <Shot key={s.photo.id} shot={s} props={props} t={t} W={W} H={H} /> : null))}
      {tl.shots.filter(s => s.inTransition === 'light' && s.inSeconds > 0).map(s => (
        <LightLeak key={`lk-${s.photo.id}`} t={t} at={s.start + s.inSeconds / 2} len={s.inSeconds * 1.8} W={W} H={H} />
      ))}
      {tl.opening && <OpeningTitle props={props} look={look} t={t} end={tl.opening.end} />}
      {tl.captions.map(c => {
        const p = props.photos.find(x => x.id === c.photoId)
        return p ? <Caption key={c.photoId} look={look} t={t} start={c.start} end={c.end} kicker={p.kicker} line={p.label} /> : null
      })}
      {tl.stats && <Stats props={props} look={look} t={t} start={tl.stats.start} end={tl.stats.end} />}
      {tl.agentBadge && <AgentBadge props={props} look={look} t={t} start={tl.agentBadge.start} end={tl.agentBadge.end} />}
      {tl.endCard && <EndCard props={props} look={look} t={t} start={tl.endCard.start} end={tl.endCard.end} bgSrc={(firstPhoto || lastPhoto)?.src} />}
      {bars > 0 && <>
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: bars, background: '#000' }} />
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: W, height: bars, background: '#000' }} />
      </>}
      {props.music !== 'none' && <Audio src={staticFile(`motion/music/${musicFile(props.music)}.m4a`)} volume={musicVol} />}
    </AbsoluteFill>
  )
}

/** Length of the video for these props, in frames (used by the player and the renderer). */
export const motionFrames = (props: MotionProps) => buildTimeline(props).frames
