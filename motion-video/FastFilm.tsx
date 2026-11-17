// "Fast Cut" - TEST (11/14, local only, not wired into the app). A second kind of video built on the
// Cinematic camera: many short shots cut exactly on a song's beats, each one a quick camera move that
// rushes in and settles, blur only in the split second around a cut, a rapid-fire burst of stills over
// the song's build, and (when the listing has the same view by day and at dusk) a day-to-night snap.
// The shot list is worked out beforehand from the song's beat map and arrives as plain times, so this
// file only draws what it is told.
import React from 'react'
import { AbsoluteFill, Audio, Img, Easing, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { CinePhoto, type CineCam } from './CinePhoto'
import { AgentBadge, OpeningTitle, lookOf, resolveSrc, useMotionFonts } from './Overlays'
import type { MotionFormat, MotionProps, PhotoKind } from './types'

export type FastMove = 'sweep' | 'push' | 'pull' | 'rise' | 'orbit' | 'still'
export type FastFx = 'cut' | 'zoom' | 'whip' | 'flash'

export type FastShot = {
  id: string
  src: string
  depth?: string | null
  sharpDepth?: boolean
  kind: PhotoKind
  /** Seconds. Shots never overlap: each cut lands on a beat. */
  start: number
  end: number
  move: FastMove
  dir?: number
  /** How big the move is (1 = normal). */
  amt?: number
  /** settle = rushes in then glides; launch = builds speed into the cut; steady = even. */
  ramp?: 'settle' | 'launch' | 'steady'
  inFx?: FastFx
  outFx?: FastFx
  focusX?: number
  /** The editor's framing (AI): where the centre of the frame starts and ends across the photo, 0 = left edge,
   *  1 = right edge. The camera turns from one to the other, so a shot ends on its best composition. */
  fromX?: number
  toX?: number
  /** Share of one continuous camera move this shot covers (two photos of the same view, e.g. day then dusk). */
  camFrom?: number
  camTo?: number
  water?: boolean
  sky?: boolean
  /** A lit fireplace in the photo (and where it is) - its flames flicker. */
  fire?: boolean
  fireBox?: number[] | null
  /** The ending only: this daytime photo turns to dusk, and these windows glow ([left, top, right, bottom]). */
  dusk?: boolean
  windows?: number[][] | null
  /** The ending only: the AI Twilight version of this photo (same size, lined up) - the shot dissolves into it on the
   *  same camera move instead of drawing the dusk itself (owner 11/16). */
  duskSrc?: string | null
  /** Brightness band of the wall around the windows ([low, high]) - pixels inside it do not glow. */
  winGate?: number[] | null
  /** Lamps / lit windows in the photo - they glow softly. */
  lights?: boolean
  /** A property fact shown over this shot (longer shots only): "4" / "Bedrooms". */
  fact?: { value: string; label: string }
}

export type FastText = {
  address: string
  cityLine: string
  price?: string
  stats?: string
  courtesy?: string
  /** When the address tag shows (the calm shot), and when the closing words start. */
  titleAt?: [number, number]
  endAt?: number
  /** Closing words at the top instead (tall videos whose last photo has the house low in the frame). */
  endTop?: boolean
  /** The opening title (the same one a Cinematic Video opens with) stays until this second. */
  openEnd?: number
  /** How the opening title is drawn: the Cinematic title (default), heavy lettering, or a nameplate. */
  titleStyle?: 'cinematic' | 'bold' | 'plate'
  kicker?: string
  tagline?: string
}

/** The agent's own choices, in the same shape the Cinematic editor saves them (look, what it's for,
 *  their words, the address, their branding and where it shows) - so both kinds of video are set up
 *  the same way. */
export type FastBrand = Pick<MotionProps, 'theme' | 'accent' | 'metal' | 'situation' | 'copy' | 'facts' | 'agent' | 'sections'>

export type FastProps = {
  shots: FastShot[]
  format: MotionFormat
  /** Song file under public/ (e.g. "motion/fastcut/skyline.wav"). */
  music?: string
  duration: number
  text?: FastText
  accent?: string
  brand?: FastBrand
  perf?: { steps?: number; glow?: number; dil?: number }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const lerp = (a: number, b: number, p: number) => a + (b - a) * p
const outCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const ss = Easing.bezier(0.42, 0, 0.58, 1)

type Pose = { x: number; y: number; z: number; pan: number; tilt: number }

function lensFor(kind: PhotoKind) {
  switch (kind) {
    case 'aerial': return { zNear: 1.3, zFar: 5, focal: 0.7 }
    case 'exterior': return { zNear: 1.9, zFar: 16, focal: 0.6 }
    case 'pool':
    case 'outdoor': return { zNear: 1.7, zFar: 12, focal: 0.6 }
    case 'detail': return { zNear: 1.15, zFar: 4, focal: 0.62 }
    default: return { zNear: 1.3, zFar: 6.5, focal: 0.6 }
  }
}

/** Where the camera starts and ends. A tall video shows only the middle of a wide photo, so the camera
 *  can turn a long way across the room for free (panK); a wide video has no spare photo to turn into. */
function plan(move: FastMove, a: number, d: number, panK: number): { from: Pose; to: Pose; lookK: number } {
  const P = (x: number, y: number, z: number, pan: number, tilt: number): Pose => ({ x, y, z, pan, tilt })
  switch (move) {
    case 'sweep': return { from: P(0.03 * a * d, 0, 0, -6.5 * a * d * panK, 0), to: P(-0.03 * a * d, 0, 0.05 * a, 6.5 * a * d * panK, 0), lookK: 0.55 }
    case 'push': return { from: P(-0.012 * a * d, 0.004, -0.02, -1.6 * a * d * panK, 0.3 * a), to: P(0.012 * a * d, -0.004, 0.17 * a, 1.6 * a * d * panK, -0.3 * a), lookK: 0.5 }
    case 'pull': return { from: P(0.012 * a * d, -0.004, 0.17 * a, 1.6 * a * d * panK, -0.3 * a), to: P(-0.012 * a * d, 0.004, -0.02, -1.6 * a * d * panK, 0.3 * a), lookK: 0.5 }
    case 'rise': return { from: P(0, 0.045 * a, -0.01, -1.2 * a * d * panK, 1.3 * a), to: P(-0.01 * a * d, -0.035 * a, 0.07 * a, 1.2 * a * d * panK, -1.3 * a), lookK: 0.5 }
    case 'orbit': return { from: P(-0.06 * a * d, 0, 0, 1.0 * a * d, 0), to: P(0.06 * a * d, 0, 0.03 * a, -1.0 * a * d, 0), lookK: 0.42 }
    default: return { from: P(0, 0, 0, -0.6 * a * d * panK, 0), to: P(0, 0, 0.04 * a, 0.6 * a * d * panK, 0), lookK: 0.5 }
  }
}

/** How far a close edge may slide against what's behind it in a Fast Cut (see CinePhoto SAFE_SHIFT). Owner 11/16: window
 *  frames, door frames and chair backs bent during sweeps (the crisp-depth limit was 0.026). A Fast Cut shot lasts a second
 *  or two and the sweep comes from the turn and the zoom, which never bend anything - so the 3D slide is kept small. */
const FAST_SAFE = Number((globalThis as { FAST_SAFE_TEST?: number }).FAST_SAFE_TEST) || 0.006

const IN_SECONDS = 0.23
const OUT_SECONDS = 0.27

const Shot: React.FC<{ s: FastShot; index: number; t: number; W: number; H: number; last: boolean; dur: number; perf?: FastProps['perf'] }> = ({ s, index, t, W, H, last, dur, perf }) => {
  const tall = H > W * 1.1
  const panK = tall ? 1 : W > H * 1.1 ? 0.4 : 0.7
  const lens = lensFor(s.kind)
  const aimK = tall ? 1 : W > H * 1.1 ? 0 : 0.5 // a wide video already shows the whole photo: nothing to aim
  const aimed = s.fromX != null && s.toX != null && aimK > 0
  const d = aimed ? ((s.toX as number) >= (s.fromX as number) ? 1 : -1) : s.dir ?? (index % 2 === 0 ? 1 : -1)
  const pl = plan(s.move, s.amt ?? 1, d, panK)
  if (aimed) {
    const yawOf = (x: number) => (Math.atan(((x - 0.5) * aimK) / lens.focal) * 180) / Math.PI
    pl.from.pan = yawOf(s.fromX as number)
    pl.to.pan = yawOf(s.toX as number)
  }
  const span = Math.max(0.05, s.end - s.start)
  const p0 = clamp01((t - s.start) / span)
  const pc = lerp(s.camFrom ?? 0, s.camTo ?? 1, p0)
  const ramp = s.ramp || 'settle'
  const prog = ramp === 'settle' ? 0.78 * outCubic(pc) + 0.22 * pc : ramp === 'launch' ? 0.8 * pc * pc * pc + 0.2 * pc : pc
  const x = lerp(pl.from.x, pl.to.x, prog)
  const y = lerp(pl.from.y, pl.to.y, prog)
  const z = lerp(pl.from.z, pl.to.z, prog)
  const look = lens.zFar * pl.lookK

  const inFx = s.inFx || 'cut'
  const outFx = s.outFx || 'cut'
  const qi = clamp01((t - s.start) / IN_SECONDS)          // 0 -> 1 over the first moments
  const qo = clamp01((t - (s.end - OUT_SECONDS)) / OUT_SECONDS) // 0 -> 1 over the last moments
  // Lens zoom: every shot rushes in a touch and keeps creeping (zooming never warps anything).
  const rest = inFx === 'zoom' ? 1.15 : s.move === 'still' ? 1.03 : 1.06
  let zoom = s.move === 'pull'
    ? 1.1 - 0.1 * prog
    : 1 + (rest - 1) * outCubic(clamp01((t - s.start) / 0.32)) + 0.035 * prog
  // Rapid-fire stills: no pan and no rush, just a small steady zoom, in and out by turns.
  if (s.move === 'still') zoom = index % 2 === 0 ? 1.02 + 0.07 * p0 : 1.09 - 0.07 * p0
  if (s.camFrom != null && s.camFrom > 0) zoom = rest + 0.035 * prog // second half of a shared move: no new rush
  let radial = 0
  let streak = 0
  let extraYaw = 0
  let exposure = 1
  const whipDeg = 9 * panK
  if (inFx === 'zoom') radial = (1 - qi) * (1 - qi) * 110
  if (inFx === 'whip') { extraYaw -= whipDeg * (1 - outCubic(qi)); streak = (1 - outCubic(qi)) * 170 }
  if (inFx === 'flash') exposure = 1 + 0.28 * (1 - clamp01((t - s.start) / 0.16))
  if (outFx === 'zoom') { zoom *= 1 + 0.9 * qo * qo; radial = Math.max(radial, Math.pow(qo, 1.5) * 120) }
  if (outFx === 'whip') { extraYaw += whipDeg * qo * qo; streak = Math.max(streak, qo * qo * 170) }

  const dz = Math.max(0.5, look - z)
  const yaw = (Math.atan2(-x, dz) * 180) / Math.PI + lerp(pl.from.pan, pl.to.pan, prog) + extraYaw
  const pitch = (Math.atan2(y, dz) * 180) / Math.PI + lerp(pl.from.tilt, pl.to.tilt, prog)
  const maxAbs = (a: number, b: number) => Math.max(Math.abs(a), Math.abs(b))
  const whipRoom = inFx === 'whip' || outFx === 'whip' ? whipDeg : 0
  const black = last ? ss(clamp01((t - (dur - 0.9)) / 0.8)) : 0
  const cam: CineCam = {
    pos: [x, y, z], yaw, pitch, roll: 0,
    focal: lens.focal, crop: 1, zoom, zNear: lens.zNear, zFar: lens.zFar,
    range: {
      pan: maxAbs(pl.from.pan, pl.to.pan) + (maxAbs(pl.from.x, pl.to.x) / Math.max(0.5, look)) * 57.3 + whipRoom + 0.15,
      tilt: maxAbs(pl.from.tilt, pl.to.tilt) + (maxAbs(pl.from.y, pl.to.y) / Math.max(0.5, look)) * 57.3 + 0.1,
      x: maxAbs(pl.from.x, pl.to.x) + 0.003,
      y: maxAbs(pl.from.y, pl.to.y) + 0.003,
      back: Math.max(0, -Math.min(pl.from.z, pl.to.z)),
    },
    focus: 0.4, aperture: 0,
    time: t, lightsOn: 1, flicker: 0,
    lights: s.lights ? 1 : 0, water: s.water ? 2 : 0, sky: s.sky ? 2 : 0, sway: 0,
    shotTime: t - s.start, dusk: s.dusk ? ss(clamp01((t - s.start - 0.3) / 1.5)) : 0, windows: s.dusk ? s.windows : null, winGate: s.dusk ? s.winGate : null,
    fire: s.fire && s.fireBox ? 3 : 0, fireBox: s.fire && s.fireBox ? (s.fireBox as never) : null,
    exposure, focusX: aimed ? 0.5 : s.focusX ?? 0.5, streak: [streak, 0], radial, black, blurTaps: 32,
    safe: FAST_SAFE,
    travel: Math.max(Math.hypot(pl.from.x, pl.from.y, pl.from.z), Math.hypot(pl.to.x, pl.to.y, pl.to.z)),
  }
  return (
    <AbsoluteFill>
      <CinePhoto src={s.src} depth={s.depth} W={W} H={H} cam={s.duskSrc ? { ...cam, dusk: 0, windows: null } : cam} perf={perf} />
      {s.duskSrc && (
        // the AI Twilight photo on the very same camera (same size, same depth map), faded in as the day fades
        <AbsoluteFill style={{ opacity: cam.dusk || 0 }}>
          <CinePhoto src={s.duskSrc} depth={s.depth} W={W} H={H} cam={{ ...cam, dusk: 0, windows: null }} perf={perf} />
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}

const sans = '"Montserrat", Arial, sans-serif'
const riseIn = Easing.bezier(0.16, 0.8, 0.2, 1)

/** One line that slides up from behind an invisible edge. */
const Line: React.FC<{ t: number; at: number; out?: number; children: React.ReactNode; style: React.CSSProperties }> = ({ t, at, out, children, style }) => {
  const a = riseIn(clamp01((t - at) / 0.45))
  const o = out != null ? 1 - clamp01((t - out) / 0.25) : 1
  return (
    <div style={{ overflow: 'hidden', padding: '0.08em 0' }}>
      <div style={{ ...style, transform: `translateY(${Math.round((1 - a) * 110)}%)`, opacity: Math.min(1, a * 1.5) * o }}>{children}</div>
    </div>
  )
}

const AgentRow: React.FC<{ agent: MotionProps['agent']; u: number; accent: string; opacity: number; big?: boolean }> = ({ agent, u, accent, opacity, big }) => {
  const k = big ? 1 : 0.86
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 * u * k, opacity, textShadow: '0 2px 14px rgba(0,0,0,0.75)' }}>
      {agent.photo && <Img src={resolveSrc(agent.photo)} style={{ width: 150 * u * k, height: 150 * u * k, borderRadius: '50%', objectFit: 'cover', objectPosition: '50% 20%', imageRendering: 'auto', border: `${4 * u}px solid ${accent}`, boxShadow: '0 6px 24px rgba(0,0,0,0.5)' }} />}
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 44 * u * k, lineHeight: 1.1, color: '#fff', whiteSpace: 'nowrap' }}>{agent.name}</div>
        {agent.brokerage && <div style={{ fontFamily: sans, fontWeight: 700, fontSize: 22 * u * k, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', marginTop: 4 * u, whiteSpace: 'nowrap' }}>{agent.brokerage}</div>}
        {(agent.phone || agent.email) && <div style={{ fontFamily: sans, fontWeight: 400, fontSize: 25 * u * k, color: 'rgba(255,255,255,0.95)', marginTop: 6 * u, whiteSpace: 'nowrap' }}>{[agent.phone, agent.email].filter(Boolean).join('  ·  ')}</div>}
      </div>
    </div>
  )
}

const OwnTitle: React.FC<{ text: FastText; t: number; W: number; H: number; accent: string; end: number; plate: boolean; agent?: MotionProps['agent'] | null
  kicker?: string; stats?: string; wait?: number }> = ({ text, t, W, H, accent, end, plate, agent, kicker, stats, wait }) => {
  const u = Math.min(W, H) / 1080
  const tall = H > W * 1.1
  const wide = W > H * 1.1
  const T0 = wait ?? 0.55                            // the photo is seen by itself first
  const out = 1 - clamp01((t - (end - 0.45)) / 0.4)
  const draw = riseIn(clamp01((t - T0) / 0.95))      // the gold border traces itself round
  const fill = clamp01((t - T0 - 0.2) / 0.5)         // the panel fades in behind it
  const room = wide ? W / u * 0.5 : W / u - (plate ? 260 : 140)
  const size = Math.min(wide ? 84 : 104, room / (Math.max(8, text.address.length) * 0.72))
  const row = agent?.name ? (
    <div style={{ transform: `translateY(${Math.round((1 - riseIn(clamp01((t - T0 - 1.15) / 0.5))) * (wide ? -18 : 24) * u)}px)`, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.9)) drop-shadow(0 0 12px rgba(0,0,0,0.6))' }}>
      <AgentRow agent={agent} u={u} accent={accent} opacity={clamp01((t - T0 - 1.15) / 0.45)} />
    </div>
  ) : null
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {/* wide: the agent's branding in the top-left corner */}
      {wide && row && <div style={{ position: 'absolute', left: 56 * u, top: 44 * u }}>{row}</div>}
      <AbsoluteFill style={wide
        ? { alignItems: 'flex-start', justifyContent: 'flex-end', flexDirection: 'column', padding: `0 0 ${H * 0.1}px ${56 * u}px` }
        : { alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: `0 ${50 * u}px ${H * (tall ? 0.26 : 0.12)}px` }}>
        <div style={{ position: 'relative', textAlign: wide ? 'left' : 'center', padding: plate ? `${40 * u}px ${52 * u}px ${44 * u}px` : 0,
          filter: plate ? undefined : 'drop-shadow(0 3px 3px rgba(0,0,0,0.9)) drop-shadow(0 0 14px rgba(0,0,0,0.6))' }}>
          {plate && <div style={{ position: 'absolute', inset: 0, background: 'rgba(14,14,16,0.84)', borderRadius: 14 * u, opacity: fill, boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }} />}
          {plate && (
            <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
              <rect x="0" y="0" width="100%" height="100%" rx={14 * u} fill="none" stroke={accent} strokeWidth={2.5 * u} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
              <rect x={9 * u} y={9 * u} width={`calc(100% - ${18 * u}px)`} height={`calc(100% - ${18 * u}px)`} rx={8 * u} fill="none" stroke={accent} strokeOpacity={0.45} strokeWidth={1 * u} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - riseIn(clamp01((t - T0 - 0.25) / 0.95))} />
            </svg>
          )}
          <div style={{ position: 'relative' }}>
            {kicker && <Line t={t} at={T0 + 0.5} style={{ fontFamily: sans, fontWeight: 700, fontSize: 30 * u, letterSpacing: '0.3em', color: accent, textTransform: 'uppercase' }}>{kicker}</Line>}
            <Line t={t} at={T0 + 0.65} style={{ fontFamily: sans, fontWeight: 700, fontSize: size * u, lineHeight: 1.06, color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 12 * u }}>{text.address}</Line>
            <div style={{ width: Math.round(200 * u * riseIn(clamp01((t - T0 - 0.85) / 0.5))), height: Math.max(2, Math.round(4 * u)), background: accent, margin: wide ? `${20 * u}px 0 ${16 * u}px` : `${22 * u}px auto ${18 * u}px` }} />
            <Line t={t} at={T0 + 0.95} style={{ fontFamily: sans, fontWeight: 400, fontSize: 34 * u, letterSpacing: '0.22em', color: '#fff', textTransform: 'uppercase' }}>{text.cityLine}</Line>
            {stats && <Line t={t} at={T0 + 1.1} style={{ fontFamily: sans, fontWeight: 700, fontSize: 28 * u, letterSpacing: '0.14em', color: '#fff', textTransform: 'uppercase', marginTop: 20 * u }}>{stats}</Line>}
          </div>
        </div>
        {!wide && row && <div style={{ marginTop: 34 * u }}>{row}</div>}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

const Words: React.FC<{ text: FastText; t: number; W: number; H: number; accent: string; dur: number; agent?: MotionProps['agent'] | null; shots?: FastShot[] }> = ({ text, t, W, H, accent, dur, agent, shots }) => {
  const u = Math.min(W, H) / 1080
  const tall = H > W * 1.1
  const shade = (o: number) => (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: H * (tall ? 0.62 : 0.7), opacity: o, background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.5) 38%, rgba(0,0,0,0) 100%)' }} />
  )
  // a long address shrinks to stay on one line (it used to wrap and leave "CT" alone on a second line)
  const fit = (base: number) => Math.min(base, (W / u - 140) / (Math.max(8, text.address.length) * 0.74))
  const out: React.ReactNode[] = []
  if (text.titleAt) {
    const [a, b] = text.titleAt
    if (t >= a - 0.05 && t <= b + 0.3) {
      const o = clamp01((t - a) / 0.4) * (1 - clamp01((t - b) / 0.25))
      out.push(
        <AbsoluteFill key="title">
          {shade(o * 0.85)}
          <div style={{ position: 'absolute', left: 70 * u, right: 70 * u, bottom: H * (tall ? 0.085 : 0.1) }}>
            <div style={{ width: Math.round(84 * u * riseIn(clamp01((t - a) / 0.5))), height: Math.max(2, Math.round(4 * u)), background: accent, marginBottom: 22 * u, opacity: o }} />
            <Line t={t} at={a + 0.05} out={b} style={{ fontFamily: sans, fontWeight: 700, fontSize: fit(84) * u, lineHeight: 1.08, letterSpacing: '0.01em', color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{text.address}</Line>
            <Line t={t} at={a + 0.17} out={b} style={{ fontFamily: sans, fontWeight: 400, fontSize: 36 * u, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', marginTop: 8 * u }}>{text.cityLine}</Line>
          </div>
        </AbsoluteFill>,
      )
    }
  }
  // A property fact over a longer shot (owner 11/14: "like we do on the cinematic version"): a big number
  // and a small label, in step with the cut.
  const fs = (shots || []).find(x => x.fact && t >= x.start && t < x.end)
  if (fs && fs.fact) {
    const o = clamp01((t - fs.start - 0.1) / 0.25) * (1 - clamp01((t - (fs.end - 0.22)) / 0.18))
    out.push(
      <AbsoluteFill key={'fact' + fs.id}>
        {shade(o * 0.8)}
        <div style={{ position: 'absolute', left: 70 * u, right: 70 * u, bottom: H * (tall ? 0.085 : 0.1) }}>
          <div style={{ width: Math.round(64 * u * riseIn(clamp01((t - fs.start - 0.1) / 0.4))), height: Math.max(2, Math.round(4 * u)), background: accent, marginBottom: 14 * u, opacity: o }} />
          <Line t={t} at={fs.start + 0.12} out={fs.end - 0.22} style={{ fontFamily: sans, fontWeight: 700, fontSize: (/^[\d.,\s·]+$/.test(fs.fact.value) ? 120 : Math.min(84, 900 / Math.max(6, fs.fact.value.length))) * u, lineHeight: 1.05, color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{fs.fact.value}</Line>
          {fs.fact.label && <Line t={t} at={fs.start + 0.22} out={fs.end - 0.22} style={{ fontFamily: sans, fontWeight: 700, fontSize: 30 * u, letterSpacing: '0.24em', color: accent, textTransform: 'uppercase', marginTop: 6 * u }}>{fs.fact.label}</Line>}
        </div>
      </AbsoluteFill>,
    )
  }
  if (text.endAt != null && t >= text.endAt && text.titleStyle === 'plate') {
    const o = 1 - ss(clamp01((t - (dur - 0.9)) / 0.7))
    out.push(
      <AbsoluteFill key="endplate" style={{ opacity: o }}>
        <OwnTitle text={text} t={t - text.endAt} W={W} H={H} accent={accent} end={999} plate agent={agent} kicker={text.price} stats={text.stats} wait={0.1} />
        {text.courtesy && <div style={{ position: 'absolute', left: 0, right: 0, bottom: (tall ? 64 : 30) * u, textAlign: W > H * 1.1 ? 'right' : 'center', paddingRight: W > H * 1.1 ? 56 * u : 0, fontFamily: sans, fontWeight: 400, fontSize: 17 * u, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)', textShadow: '0 1px 6px rgba(0,0,0,0.9)', opacity: clamp01((t - text.endAt - 1.0) / 0.5) }}>{text.courtesy}</div>}
      </AbsoluteFill>,
    )
  } else if (text.endAt != null && t >= text.endAt) {
    const a = text.endAt + 0.25
    const o = clamp01((t - text.endAt) / 0.5) * (1 - ss(clamp01((t - (dur - 0.9)) / 0.7)))
    out.push(
      <AbsoluteFill key="end">
        {/* no shade behind the closing words either (owner 11/15) */}
        <div style={{ position: 'absolute', left: 70 * u, right: 70 * u, ...(text.endTop && tall ? { top: H * 0.13 } : { bottom: H * (tall ? 0.22 : 0.11) }), textAlign: 'center', opacity: o > 0.02 ? 1 : 0, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.95)) drop-shadow(0 0 10px rgba(0,0,0,0.75)) drop-shadow(0 0 26px rgba(0,0,0,0.45))' }}>
          {text.price && <Line t={t} at={a} style={{ fontFamily: sans, fontWeight: 700, fontSize: 34 * u, letterSpacing: '0.26em', color: accent, textTransform: 'uppercase' }}>{text.price}</Line>}
          <Line t={t} at={a + 0.1} style={{ fontFamily: sans, fontWeight: 700, fontSize: fit(90) * u, lineHeight: 1.08, color: '#fff', textTransform: 'uppercase', whiteSpace: 'nowrap', marginTop: 10 * u }}>{text.address}</Line>
          <Line t={t} at={a + 0.2} style={{ fontFamily: sans, fontWeight: 400, fontSize: 30 * u, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.92)', textTransform: 'uppercase', marginTop: 8 * u }}>{text.cityLine}</Line>
          {text.stats && <Line t={t} at={a + 0.32} style={{ fontFamily: sans, fontWeight: 700, fontSize: 29 * u, letterSpacing: '0.14em', color: '#fff', textTransform: 'uppercase', marginTop: 26 * u }}>{text.stats}</Line>}
          {/* Owner 11/14: the agent's branding on the ending whenever they have it turned on */}
          {agent?.name && <div style={{ marginTop: 40 * u }}><AgentRow agent={agent} u={u} accent={accent} opacity={clamp01((t - a - 0.45) / 0.45) * o} big /></div>}
          {text.courtesy && !agent?.name && <div style={{ fontFamily: sans, fontWeight: 400, fontSize: 22 * u, color: 'rgba(255,255,255,0.72)', marginTop: 30 * u, opacity: clamp01((t - a - 0.6) / 0.5) * o }}>{text.courtesy}</div>}
        </div>
        {text.courtesy && agent?.name && <div style={{ position: 'absolute', left: 0, right: 0, bottom: (tall ? 64 : 34) * u, textAlign: 'center', fontFamily: sans, fontWeight: 400, fontSize: 17 * u, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', opacity: clamp01((t - a - 0.6) / 0.5) * o }}>{text.courtesy}</div>}
      </AbsoluteFill>,
    )
  }
  return <>{out}</>
}

export const FastFilm: React.FC<FastProps> = (props) => {
  useMotionFonts()
  const frame = useCurrentFrame()
  const { fps, width: W, height: H, durationInFrames } = useVideoConfig()
  // half a frame in, so a cut that falls between two frames never flickers back
  const t = (frame + 0.001) / fps
  const dur = durationInFrames / fps
  const shots = props.shots
  const brand = props.brand
  const look = brand ? lookOf(brand as MotionProps, W, H) : null
  const openEnd = props.text?.openEnd || 0
  const OPEN_PACE = 1.7   // the Cinematic title's letter-by-letter timing, played this much faster
  const agentOn = brand && brand.sections?.agent !== 'off' ? brand.agent : null
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {/* a little more colour and snap than the calm Cinematic grade */}
      <AbsoluteFill style={{ filter: 'saturate(1.1) contrast(1.04)' }}>
        {shots.map((s, i) => (t >= s.start && t < s.end ? <Shot key={s.id} s={s} index={i} t={t} W={W} H={H} last={i === shots.length - 1} dur={dur} perf={props.perf} /> : null))}
      </AbsoluteFill>
      {brand && look && openEnd > 0 && t < openEnd && (
        <>
          {/* no shade over the photo at all (owner 11/15): the words carry their own shadow. Title centred on
              screen, the agent's branding at the top. */}
          <AbsoluteFill style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.95)) drop-shadow(0 0 10px rgba(0,0,0,0.75)) drop-shadow(0 0 26px rgba(0,0,0,0.45))' }}>
            {props.text?.titleStyle && props.text.titleStyle !== 'cinematic'
              ? null
              : <OpeningTitle props={brand as MotionProps} look={look} t={t * OPEN_PACE} end={openEnd * OPEN_PACE} />}
            {agentOn?.name && !(props.text?.titleStyle && props.text.titleStyle !== 'cinematic') && <AgentBadge props={brand as MotionProps} look={look} t={t} start={0.25} end={openEnd} />}
          </AbsoluteFill>
          {props.text?.titleStyle && props.text.titleStyle !== 'cinematic' && (
            <OwnTitle text={props.text} t={t} W={W} H={H} accent={props.accent || '#E8C98A'} end={openEnd} plate={props.text.titleStyle === 'plate'} agent={agentOn} kicker={props.text.kicker} />
          )}
        </>
      )}
      {props.text && <Words text={props.text} t={t} W={W} H={H} accent={props.accent || '#E8C98A'} dur={dur} agent={agentOn} shots={shots} />}
      {props.music && <Audio src={staticFile(props.music)} volume={(f) => 1 - clamp01((f / fps - (dur - 0.5)) / 0.5)} />}
    </AbsoluteFill>
  )
}
