// One photo as a moving camera shot. Two WebGL passes:
//  1) SCENE - the photo becomes a 3D surface from its depth map and a virtual camera physically
//     moves through it (dolly / slide / crane / orbit / drone) with true perspective, found per
//     pixel by ray-marching the depth surface. Living touches are worked out from the photo's own
//     colours (no extra files): warm lights, pool water, sky drift, trees in a breeze.
//  2) LENS - depth-of-field (incl. focus pulls), warm highlight glow, light sharpening, film
//     grade, vignette, grain, plus the transition streaks (whip / zoom) and fade to black.
// Real photo pixels only: nothing is invented.
import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { continueRender, delayRender, staticFile } from 'remotion'
import { isBuiltIn } from './types'

const res = (s: string) => (isBuiltIn(s) ? staticFile(s.slice(1)) : s)

export type CineCam = {
  pos: [number, number, number]
  yaw: number; pitch: number; roll: number // degrees
  focal: number   // source lens focal length in image-width units (0.6 ~ an 80deg wide angle)
  crop: number    // least zoom (1 = the whole photo); range adds what the moves need
  /** The most this shot turns (degrees) and moves (scene units; back = behind the photo's own
   *  viewpoint), so the zoom is just enough that the camera never runs off the photo's edge. */
  range?: { pan: number; tilt: number; x: number; y: number; back: number }
  zoom?: number  // extra lens zoom on top (zoom-through transition) - no parallax, never warps
  zNear: number; zFar: number
  focus: number   // disparity (0 far .. 1 near) that is sharp
  aperture: number // blur px (at 1080) per unit of disparity away from focus
  time: number
  lightsOn: number; flicker: number
  water: number; sky: number; sway: number; lights: number
  /** A lit fire: 0..1, and where its flames are ([left, top, right, bottom], 0-1 of the photo). */
  fire?: number; fireBox?: number[] | null
  exposure: number
  focusX: number  // subject left-right, keeps tall formats framed on it
  streak: [number, number] // whip-pan blur, px at 1080
  radial: number  // zoom-through blur, px at 1080
  black: number   // 0..1 fade to black
  /** How far this shot's camera travels at most (scene units) - with the photo's own depth edges it
   *  sets the safe move (see SAFE_SHIFT). Unset = no limit. */
  travel?: number
  /** Test only: a different no-warp limit (see SAFE_SHIFT). */
  safe?: number
}

/** The most a close edge may slide against what's behind it, as a share of the frame width, at the
 *  farthest point of a shot's move. A single photo has nothing to show behind a chair or a bed post, so
 *  past this it would warp. Moves are centred on the photo's own viewpoint (MotionFilm movePlan), so the
 *  camera still covers twice this. What's cut becomes a lens zoom (plus the turn the move already has) -
 *  zooming and turning never stretch anything. 0.04 warped chairs at shot ends; 0.016 is clean. */
const SAFE_SHIFT = 0.016
/** The same limit for a photo whose depth map has crisp edges (Marigold, sharpDepth): the stretch stays
 *  on the object's own outline instead of bulging the wall around it. Tested 11/12 on chairs and bed
 *  posts: 0.026 looks like the soft map at 0.016; 0.036 frayed a wingback chair's edge. */
export const SAFE_SHIFT_SHARP = 0.026

/** Fill what's behind close objects (bgPlates + the shader's pass-behind). OFF: with today's depth maps
 *  the fill frays thin things (a chair's top rail, a bed post) more than the small stretch it replaces
 *  at SAFE_SHIFT. Kept for a sharper depth model, which would let moves grow again. */
const BEHIND_FILL = false

// Same edge calming as the shader's disp() - the safe move measures what will actually be drawn.
const calmDepth = (r: number, ux: number) => {
  const x = Math.min(ux, 1 - ux)
  const t = Math.min(1, Math.max(0, (x - 0.02) / 0.22))
  const e = t * t * (3 - 2 * t)
  const cap = 0.42 + 0.58 * e
  return r - Math.max(0, r - cap) * 0.85
}

/** The biggest near-vs-far jump in this depth map (0..1), ignoring the odd stray pixel. */
function depthEdge(img: TexImageSource & { width: number; height: number }): number {
  try {
    const w = 160
    const h = Math.max(4, Math.round(w * (img.height / Math.max(1, img.width))))
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const x = c.getContext('2d', { willReadFrequently: true })!
    x.drawImage(img as CanvasImageSource, 0, 0, w, h)
    const d = x.getImageData(0, 0, w, h).data
    const v = (i: number, j: number) => calmDepth(d[(j * w + i) * 4] / 255, i / w)
    // The whole near-to-far step across a softened edge (6 cells ~ 4% of the width), not just its middle.
    const S = 6
    const diffs: number[] = []
    for (let j = 0; j < h - S; j += 1) {
      for (let i = 0; i < w - S; i += 1) {
        const a = v(i, j)
        diffs.push(Math.abs(a - v(i + S, j)), Math.abs(a - v(i, j + S)))
      }
    }
    diffs.sort((p, q) => p - q)
    return diffs[Math.floor(diffs.length * 0.996)] || 0
  } catch {
    return 0.35 // couldn't read it - assume an ordinary room
  }
}

/** What's BEHIND close objects, made once per photo: a depth map and a photo with the near edges of
 *  chairs, posts, lamps etc. taken out and filled in from the room around them. When the camera moves,
 *  the strip it uncovers next to a close object shows this instead of the object's pixels pulled
 *  sideways - the object keeps its shape and the move keeps its size. */
function bgPlates(img: HTMLImageElement, dep: CanvasImageSource): { color: HTMLCanvasElement; depth: HTMLCanvasElement } | null {
  try {
    const w = 512
    const h = Math.max(4, Math.round(w * ((img.naturalHeight || img.height) / Math.max(1, img.naturalWidth || img.width))))
    const read = (src: CanvasImageSource) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(src, 0, 0, w, h)
      return { c, x, data: x.getImageData(0, 0, w, h) }
    }
    const P = read(img), Dd = read(dep)
    const n = w * h
    const d = new Float32Array(n)
    for (let i = 0; i < n; i++) d[i] = Dd.data.data[i * 4] / 255
    // 1) the farthest depth within reach of each point (bright = near, so the minimum) = the room behind
    const R = Math.round(w * 0.075)
    const minPass = (src: Float32Array, horiz: boolean) => {
      const out = new Float32Array(n)
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        let m = 1
        for (let k = -R; k <= R; k++) {
          const a = horiz ? i + k : i, b = horiz ? j : j + k
          if (a < 0 || b < 0 || a >= w || b >= h) continue
          const v = src[b * w + a]; if (v < m) m = v
        }
        out[j * w + i] = m
      }
      return out
    }
    const far = minPass(minPass(d, true), false)
    // 2) the near edge band: clearly closer than the room behind it, grown 3 px to take the soft rim too
    const fg = new Uint8Array(n)
    for (let i = 0; i < n; i++) if (d[i] - far[i] > 0.08) fg[i] = 1
    const grow = new Uint8Array(n)
    const G = 3
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (!fg[j * w + i]) continue
      for (let b = Math.max(0, j - G); b <= Math.min(h - 1, j + G); b++)
        for (let a = Math.max(0, i - G); a <= Math.min(w - 1, i + G); a++) grow[b * w + a] = 1
    }
    // 3) fill the band from the room around it (push-pull: average outward, then back down)
    // (channels: r, g, b and depth - the hidden surface continues the depth around it, not the far wall)
    const NC = 4
    type Lv = { w: number; h: number; c: Float32Array; wt: Float32Array }
    const lv0: Lv = { w, h, c: new Float32Array(n * NC), wt: new Float32Array(n) }
    for (let i = 0; i < n; i++) {
      if (grow[i]) continue
      lv0.wt[i] = 1
      for (let ch = 0; ch < 3; ch++) lv0.c[i * NC + ch] = P.data.data[i * 4 + ch]
      lv0.c[i * NC + 3] = d[i] * 255
    }
    const levels: Lv[] = [lv0]
    while (levels[levels.length - 1].w > 1 || levels[levels.length - 1].h > 1) {
      const s = levels[levels.length - 1]
      const W2 = Math.max(1, Math.ceil(s.w / 2)), H2 = Math.max(1, Math.ceil(s.h / 2))
      const t: Lv = { w: W2, h: H2, c: new Float32Array(W2 * H2 * NC), wt: new Float32Array(W2 * H2) }
      for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
        const si = j * s.w + i, ti = (j >> 1) * W2 + (i >> 1), ww = s.wt[si]
        if (!ww) continue
        t.wt[ti] += ww
        for (let ch = 0; ch < NC; ch++) t.c[ti * NC + ch] += s.c[si * NC + ch] * ww
      }
      for (let i = 0; i < W2 * H2; i++) if (t.wt[i] > 0) {
        for (let ch = 0; ch < NC; ch++) t.c[i * NC + ch] /= t.wt[i]
        t.wt[i] = Math.min(1, t.wt[i])
      }
      levels.push(t)
    }
    for (let l = levels.length - 2; l >= 0; l--) {
      const s = levels[l], p = levels[l + 1]
      for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) {
        const si = j * s.w + i, ww = s.wt[si]
        if (ww >= 1) continue
        // bilinear from the coarser level so the fill is smooth, not blocky
        const fx = Math.min(p.w - 1, Math.max(0, (i - 0.5) / 2)), fy = Math.min(p.h - 1, Math.max(0, (j - 0.5) / 2))
        const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(p.w - 1, x0 + 1), y1 = Math.min(p.h - 1, y0 + 1)
        const ax = fx - x0, ay = fy - y0
        for (let ch = 0; ch < NC; ch++) {
          const g = (a: number, b: number) => p.c[(b * p.w + a) * NC + ch]
          const up = (g(x0, y0) * (1 - ax) + g(x1, y0) * ax) * (1 - ay) + (g(x0, y1) * (1 - ax) + g(x1, y1) * ax) * ay
          s.c[si * NC + ch] = s.c[si * NC + ch] * ww + up * (1 - ww)
        }
        s.wt[si] = 1
      }
    }
    const out = P.x.createImageData(w, h)
    const dOut = Dd.x.createImageData(w, h)
    for (let i = 0; i < n; i++) {
      for (let ch = 0; ch < 3; ch++) out.data[i * 4 + ch] = grow[i] ? lv0.c[i * NC + ch] : P.data.data[i * 4 + ch]
      out.data[i * 4 + 3] = 255
      // the depth behind: carried in from the surface around it, never nearer than the photo itself
      const v = grow[i] ? Math.min(d[i] * 255, lv0.c[i * NC + 3]) : d[i] * 255
      dOut.data[i * 4] = dOut.data[i * 4 + 1] = dOut.data[i * 4 + 2] = Math.round(v); dOut.data[i * 4 + 3] = 255
    }
    P.x.putImageData(out, 0, 0); Dd.x.putImageData(dOut, 0, 0)
    return { color: P.c, depth: Dd.c }
  } catch {
    return null
  }
}

const VS = `attribute vec2 p; varying vec2 s; void main(){ s = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`

const NOISE = `
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int k=0;k<5;k++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
vec3 hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y);
  return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-6))*360., d/(q.x+1e-6), q.x); }
float band(float v, float a, float b, float s){ return smoothstep(a-s, a+s, v) * (1.0 - smoothstep(b-s, b+s, v)); }
`

const FS_SCENE = `precision highp float;
varying vec2 s;
uniform sampler2D img; uniform sampler2D dep; uniform sampler2D bimg; uniform sampler2D bdep;
uniform float imgAsp; uniform float frameAsp; uniform vec2 texel;
uniform vec3 C; uniform vec3 rot; uniform float f; uniform float fOut;
uniform float zN; uniform float zF; uniform float steps; uniform float gapMin;
const bool USE_BEHIND = ${BEHIND_FILL ? 'true' : 'false'};
uniform float t; uniform float lightsOn; uniform float flick; uniform vec4 fx; // lights, water, sky, trees
uniform float fire; uniform vec4 fbox; // a lit fire and where its flames are (left, top, right, bottom)
${NOISE}
// Depth, calmed near the left/right edges: things close to the lens at the sides of a photo (a lamp
// post, a branch, a chair) are where 3D moves smear and stretch most, so there they move with the
// middle ground instead of on their own.
float calm(float r, vec2 uv){
  float e = smoothstep(0.02, 0.24, min(uv.x, 1.0 - uv.x));
  float cap = mix(0.42, 1.0, e);
  return r - max(0.0, r - cap) * 0.85;
}
float disp(vec2 uv){ uv = clamp(uv, 0.0, 1.0); return calm(texture2D(dep, uv).r, uv); }
// the room BEHIND close objects (see bgPlates)
float dispB(vec2 uv){ uv = clamp(uv, 0.0, 1.0); return min(disp(uv), calm(texture2D(bdep, uv).r, uv)); }
float surfAt(vec2 uv, bool b){ return b ? dispB(uv) : disp(uv); }
float surfZ(float d){ return 1.0 / (1.0/zF + (1.0/zN - 1.0/zF) * d); }
vec2 proj(vec3 X){ return vec2(X.x/X.z*f + 0.5, X.y/X.z*f/imgAsp + 0.5); }
vec3 soft(vec2 uv){ vec2 o = texel * 3.0;
  return (texture2D(img, uv).rgb*2.0 + texture2D(img, uv+vec2(o.x,0.)).rgb + texture2D(img, uv-vec2(o.x,0.)).rgb
        + texture2D(img, uv+vec2(0.,o.y)).rgb + texture2D(img, uv-vec2(0.,o.y)).rgb) / 6.0; }
void main(){
  vec2 q = vec2(s.x - 0.5, (0.5 - s.y) * frameAsp);
  vec3 d = vec3(q / fOut, 1.0);
  float cy = cos(radians(rot.x)), sy = sin(radians(rot.x));
  float cp = cos(radians(rot.y)), sp = sin(radians(rot.y));
  float cr = cos(radians(rot.z)), sr = sin(radians(rot.z));
  d.xy = vec2(cr*d.x - sr*d.y, sr*d.x + cr*d.y);
  d = vec3(d.x, cp*d.y - sp*d.z, sp*d.y + cp*d.z);
  d = vec3(cy*d.x + sy*d.z, d.y, -sy*d.x + cy*d.z);
  float z0 = max(C.z + 0.05, zN * 0.85), z1 = zF * 1.02;
  float tPrev = (z0 - C.z) / d.z;
  float tHit = (z1 - C.z) / d.z;
  // A ray that lands on the steep "wall" between a close object and the room behind it would draw
  // that object's edge pixels stretched across the gap. Instead it passes behind the object and
  // finds the room there (the behind plate): the object keeps its shape, the gap shows the room.
  bool behind = false;
  float wB = 0.0;      // how much of the room behind shows (soft, so a wobbly depth edge can't notch)
  float tFront = 0.0;  // where the ray met the close object's edge
  for (int k = 1; k <= 72; k++) {
    if (float(k) > steps) break;
    float a = float(k) / steps;
    float z = 1.0 / mix(1.0/z0, 1.0/z1, a);
    float tt = (z - C.z) / d.z;
    vec3 X = C + d * tt;
    if (X.z >= surfZ(surfAt(proj(X), behind))) {
      float lo = tPrev, hi = tt;
      for (int b = 0; b < 7; b++) {
        float m = 0.5 * (lo + hi);
        vec3 Y = C + d * m;
        if (Y.z >= surfZ(surfAt(proj(Y), behind))) hi = m; else lo = m;
      }
      if (!behind) {
        vec2 hu = proj(C + d * hi);
        // g points from the room toward the close object; m = which way the close side slides
        // against the room for this camera move. Only an edge the move is OPENING (the object sliding
        // away from it) is passed behind - and only once that gap is wide enough (~6 px) for a stretch to show - so
        // every other edge stays exactly as photographed.
        // Not in the strips along the photo's left/right sides: there close things are already
        // flattened (disp's edge calming) so they can't stretch, and the depth map's edge is least
        // reliable - passing behind there notched a bed post's outline.
        vec2 g = vec2(disp(hu + vec2(0.004, 0.0)) - disp(hu - vec2(0.004, 0.0)),
                      disp(hu + vec2(0.0, 0.004)) - disp(hu - vec2(0.0, 0.004)));
        vec2 m = vec2(-C.x * f, -C.y * f / imgAsp) + (hu - 0.5) * C.z;
        float gl = length(g);
        float gap = gl > 0.0 ? dot(g / gl, m) * (1.0/zN - 1.0/zF) * gl : 0.0;
        float side = min(hu.x, 1.0 - hu.x);
        if (USE_BEHIND && gl > 0.18 && gap > gapMin && side > 0.14) {
          behind = true; wB = 1.0; tFront = hi;
          // already past the room behind too? then that's where it lands
          if (X.z >= surfZ(dispB(proj(X)))) {
            lo = tPrev; hi = tt;
            for (int b = 0; b < 7; b++) {
              float m = 0.5 * (lo + hi);
              vec3 Y = C + d * m;
              if (Y.z >= surfZ(dispB(proj(Y)))) hi = m; else lo = m;
            }
            tHit = hi; break;
          }
          tPrev = tt; continue;
        }
      }
      tHit = hi; break;
    }
    tPrev = tt;
  }
  vec2 uv = clamp(proj(C + d * tHit), 0.001, 0.999);
  vec2 uvF = clamp(proj(C + d * tFront), 0.001, 0.999);
  float D = behind ? mix(disp(uvF), dispB(uv), wB) : disp(uv);
  vec3 sc = hsv(soft(uv));
  // trees and shrubs in a light breeze (higher up = more movement; lawns stay put)
  if (fx.w > 0.0) {
    float tm = band(sc.x, 60.0, 165.0, 12.0) * smoothstep(0.12, 0.22, sc.y) * smoothstep(0.04, 0.1, sc.z)
             * clamp((0.74 - uv.y) / 0.22, 0.0, 1.0);
    if (tm > 0.01) {
      vec2 w = vec2(fbm(uv*vec2(5.0,3.0) + vec2(t*0.32, t*0.11)) - 0.5, fbm(uv*vec2(3.0,5.0) + vec2(4.0 - t*0.21, t*0.17)) - 0.5);
      vec2 r = vec2(n(uv*80.0 + t*2.2) - 0.5, n(uv*80.0 - t*1.9 + 9.0) - 0.5);
      uv += (w * 0.0042 + r * 0.0007) * tm * fx.w * (1.15 - uv.y*0.6);
    }
  }
  // pool water: refraction ripple + moving caustic glints
  float wm = 0.0;
  if (fx.y > 0.0) {
    wm = band(sc.x, 168.0, 212.0, 10.0) * smoothstep(0.28, 0.4, sc.y) * smoothstep(0.28, 0.4, sc.z) * smoothstep(0.3, 0.45, uv.y);
    if (wm > 0.01) {
      vec2 w = vec2(fbm(uv*vec2(60.,90.)+vec2(t*0.6,t*0.4))-0.5, fbm(uv*vec2(90.,60.)-vec2(t*0.5,t*0.7))-0.5);
      uv += w*0.0032*wm*fx.y;
    }
  }
  // a lit fire: only the bright flame colours inside the box the AI marked (a colour match alone would
  // flicker wood floors); they lick upward a little and the glow breathes. Just a touch.
  float fm = 0.0;
  float ffl = 0.0;
  if (fire > 0.0) {
    vec2 bs = max(fbox.zw - fbox.xy, vec2(0.01));
    vec2 c = (uv - fbox.xy) / bs; // 0..1 inside the box, top = 0
    float inBox = smoothstep(-0.25, 0.05, c.x) * (1.0 - smoothstep(0.95, 1.25, c.x))
                * smoothstep(-0.35, 0.05, c.y) * (1.0 - smoothstep(0.95, 1.2, c.y));
    fm = inBox * band(sc.x, 6.0, 58.0, 8.0) * smoothstep(0.22, 0.42, sc.y) * smoothstep(0.42, 0.68, sc.z);
    ffl = (n(vec2(t*6.0, 2.7)) - 0.5) + 0.5*(n(vec2(t*15.0, 8.1)) - 0.5);
    if (fm > 0.01) {
      float tip = 1.25 - clamp(c.y, 0.0, 1.0); // the tips (top) move most, the base least
      vec2 w = vec2(fbm(vec2(uv.x*38.0, uv.y*16.0 + t*2.4)) - 0.5, fbm(vec2(uv.x*28.0 + 7.0, uv.y*12.0 + t*3.0)) - 0.5);
      uv += vec2(w.x*0.004*bs.x*4.0, w.y*0.006*bs.y*4.0) * fm * fire * tip;
    }
  }
  vec3 col = behind ? mix(texture2D(img, uvF).rgb, texture2D(bimg, uv).rgb, wB) : texture2D(img, uv).rgb;
  if (fire > 0.0) {
    col *= 1.0 + fm*fire*(0.16*ffl + 0.04);
    vec2 bc = (fbox.xy + fbox.zw) * 0.5;
    vec2 e = (uv - bc) / (max(fbox.zw - fbox.xy, vec2(0.02)) * 1.8);
    col += vec3(1.0, 0.55, 0.2) * exp(-dot(e, e)) * fire * 0.03 * max(0.0, 0.7 + ffl);
  }
  if (wm > 0.01) {
    float ca = pow(fbm(uv*vec2(140.,200.)+vec2(t*0.8,-t*0.6)), 3.0);
    col += vec3(0.75,0.95,1.0)*ca*0.55*wm*fx.y;
  }
  // warm lights: coming on, a soft lantern flicker, a little glow
  if (fx.x > 0.0) {
    float lm = band(sc.x, 20.0, 56.0, 5.0) * smoothstep(0.26, 0.36, sc.y) * smoothstep(0.7, 0.8, sc.z);
    if (lm > 0.01) {
      float fl = 1.0 + flick*(0.10*(n(vec2(t*7.0,1.3))-0.5) + 0.06*(n(vec2(t*19.0,4.1))-0.5));
      float lvl = mix(0.4, 1.0, lightsOn);
      col *= mix(1.0, lvl*fl, lm*fx.x);
      col += vec3(1.0,0.68,0.32)*lm*fx.x*0.10*lightsOn*fl;
    }
  }
  // sky: slow drifting soft cloud light
  if (fx.z > 0.0) {
    float km = band(sc.x, 188.0, 248.0, 10.0) * smoothstep(0.08, 0.14, sc.y) * smoothstep(0.42, 0.5, sc.z)
             * (1.0 - smoothstep(0.42, 0.58, uv.y)) * (1.0 - smoothstep(0.22, 0.34, D));
    if (km > 0.01) {
      float cl = fbm(uv*vec2(3.0,7.0)+vec2(t*0.035,0.0));
      col = mix(col, col*(0.93+0.16*cl) + vec3(0.02,0.02,0.035)*cl, km*fx.z);
    }
  }
  gl_FragColor = vec4(col, D);
}`

const FS_LENS = `precision highp float;
varying vec2 s;
uniform sampler2D scene; uniform vec2 px; uniform float focus; uniform float ap; uniform float dpr;
uniform float t; uniform float exposure; uniform float hq; uniform vec2 streak; uniform float radial; uniform float black;
${NOISE}
float coc(float D){ return clamp(abs(D - focus) * ap, 0.0, 9.0) * dpr; }
void main(){
  vec4 c0 = texture2D(scene, s);
  float r0 = coc(c0.a);
  vec3 acc = c0.rgb; float wsum = 1.0;
  float taps = hq > 0.5 ? 40.0 : 14.0;
  if (r0 > 0.6) {
    for (int i = 1; i < 40; i++) {
      float fi = float(i);
      if (fi >= taps) break;
      float rr = sqrt(fi / taps) * r0;
      float th = fi * 2.39996;
      vec4 c = texture2D(scene, s + vec2(cos(th), sin(th)) * rr * px);
      float w = smoothstep(rr - 1.5, rr + 0.5, max(coc(c.a), r0 * step(c.a, c0.a + 0.02)));
      acc += c.rgb * w; wsum += w;
    }
  }
  vec3 col = acc / wsum;
  if (r0 < 1.0) {
    vec3 nb = (texture2D(scene, s + vec2(px.x,0.)).rgb + texture2D(scene, s - vec2(px.x,0.)).rgb +
               texture2D(scene, s + vec2(0.,px.y)).rgb + texture2D(scene, s - vec2(0.,px.y)).rgb) * 0.25;
    col += (col - nb) * 0.12 * (1.0 - r0); // light crisping (0.18 made thin edges shimmer a touch more)
  }
  // transition blur: whip (sideways streak) and zoom-through (radial)
  float sl = length(streak);
  if (sl > 0.5) {
    vec3 a = vec3(0.0);
    for (int i = 0; i < 12; i++) { float k = float(i) / 11.0 - 0.5; a += texture2D(scene, s + streak * dpr * px * k).rgb; }
    col = mix(col, a / 12.0, clamp(sl / 6.0, 0.0, 1.0));
  }
  if (radial > 0.5) {
    vec2 dir = (s - 0.5); vec3 a = vec3(0.0);
    for (int i = 0; i < 12; i++) { float k = float(i) / 11.0; a += texture2D(scene, s - dir * k * radial * dpr * px * 2.0).rgb; }
    col = mix(col, a / 12.0, clamp(radial / 8.0, 0.0, 1.0));
  }
  // highlight glow only around small warm light sources (lanterns, lit windows) - not white walls
  vec3 glow = vec3(0.0);
  float gt = hq > 0.5 ? 32.0 : 10.0;
  for (int i = 0; i < 32; i++) {
    float fi = float(i);
    if (fi >= gt) break;
    float th = fi * 2.39996; float rr = sqrt((fi + 0.5) / gt) * 22.0 * dpr;
    vec3 c = texture2D(scene, s + vec2(cos(th), sin(th)) * rr * px).rgb;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    glow += c * smoothstep(0.78, 0.98, l) * smoothstep(0.18, 0.45, sat) * step(c.b * 1.25, c.r);
  }
  col += glow / gt * vec3(1.0, 0.8, 0.55) * 0.5;
  // film grade
  col *= exposure;
  col = col / (1.0 + max(col - 0.85, 0.0) * 1.6);
  col = mix(vec3(0.018, 0.015, 0.012), vec3(1.0), col);
  col = mix(col, col*col*(3.0-2.0*col), 0.22);
  float L = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(L), col, 1.06);
  col += (1.0 - L) * vec3(-0.008, 0.002, 0.012) + L * vec3(0.012, 0.004, -0.010);
  vec2 v = (s - 0.5) * vec2(1.0, 0.82);
  col *= 1.0 - 0.32 * pow(clamp(length(v) * 1.45, 0.0, 1.0), 2.4);
  // (no film grain - owner 11/12: everything crisp; grain also turned to mush once Instagram re-compressed it)
  col *= 1.0 - black;
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`

function loadImg(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error(`image ${url}`)); i.src = url
  })
}

type GLState = {
  gl: WebGLRenderingContext; scene: WebGLProgram; lens: WebGLProgram; fbo: WebGLFramebuffer; buf: WebGLBuffer
  imgW: number; imgH: number
  edge: number
}

// ---- preview quality (owner 11/12: make sure slow phones / old computers aren't stuck with a choppy
// preview). The in-browser preview times its own drawing for its first draws; if this device can't keep
// up, every photo steps down to a lighter preview - fewer pixels and fewer 3D steps - and once more if
// still slow. Never the final video (rendered on the server), never on a device that keeps up.
const PREVIEW_LEVELS = [{ scale: 1, steps: 36 }, { scale: 0.62, steps: 24 }, { scale: 0.45, steps: 16 }]
const pq = { level: 0, n: 0, sum: 0, measured: 0, subs: new Set<() => void>() }
function notePreviewDraw(ms: number) {
  if (pq.level >= PREVIEW_LEVELS.length - 1 || pq.measured > 90) return
  pq.measured++; pq.n++; pq.sum += ms
  if (pq.n < 10) return
  const avg = pq.sum / pq.n
  pq.n = 0; pq.sum = 0
  if (avg > 22) { pq.level++; pq.measured = 0; pq.subs.forEach(f => f()) }
  if (typeof window !== 'undefined') (window as unknown as { __ohpPreviewLevel?: number }).__ohpPreviewLevel = pq.level
}
const subscribePq = (cb: () => void) => { pq.subs.add(cb); return () => { pq.subs.delete(cb) } }
/** For tests / support: which preview level this browser settled on (0 = full). */
export const previewLevel = () => pq.level

export const CinePhoto: React.FC<{
  src: string; depth?: string | null; W: number; H: number; cam: CineCam; preview?: boolean
  style?: React.CSSProperties
}> = ({ src, depth, W, H, cam, preview, style }) => {
  const ref = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<GLState | null>(null)
  const [handle] = useState(() => delayRender(`photo ${src}`, { timeoutInMilliseconds: 120000 }))
  const [ready, setReady] = useState(false)
  const [flat, setFlat] = useState(false)
  const released = useRef(false)
  const release = () => { if (!released.current) { released.current = true; continueRender(handle) } }
  // The preview keeps the canvas at its on-screen size (phones), lighter still on a slow device; the
  // render uses full resolution.
  const level = useSyncExternalStore(subscribePq, () => (preview ? pq.level : 0), () => 0)
  const lite = PREVIEW_LEVELS[level]
  const draws = useRef(0)
  const dpr = preview ? lite.scale : (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
  const cw = Math.max(2, Math.round(W * dpr))
  const ch = Math.max(2, Math.round(H * dpr))

  useEffect(() => {
    let dead = false
    const flat = (() => { // a flat mid-grey "depth" when a photo has none yet
      const c = document.createElement('canvas'); c.width = 2; c.height = 2
      const x = c.getContext('2d')!; x.fillStyle = '#808080'; x.fillRect(0, 0, 2, 2); return c
    })()
    Promise.all([loadImg(res(src)), depth ? loadImg(res(depth)).catch(() => flat) : Promise.resolve(flat)]).then(([a, b]) => {
      if (dead || !ref.current) return
      const gl = ref.current.getContext('webgl', { preserveDrawingBuffer: true, antialias: false })
      if (!gl) { release(); return }
      const sh = (type: number, code: string) => {
        const o = gl.createShader(type)!; gl.shaderSource(o, code); gl.compileShader(o)
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o) || 'shader')
        return o
      }
      const prog = (fs: string) => {
        const p = gl.createProgram()!
        gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p)
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link')
        return p
      }
      const scene = prog(FS_SCENE)
      const lens = prog(FS_LENS)
      const buf = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
      const tex = (unit: number, source: TexImageSource | null, w = 0, h = 0) => {
        const tx = gl.createTexture()!; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tx)
        if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source)
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        return tx
      }
      const dsrc = b as HTMLImageElement
      // Shrink the photo ONCE, with high-quality smoothing, to about the size it's drawn at (owner
      // 11/12 saw edges "glitching" by a fireplace: the ~3200 px sharpened photo drawn ~2000 px wide
      // makes the shader skip pixels, so thin lines - a door edge, a fire screen - crawl as the camera
      // moves; the old focus blur + grain hid it). 1.3x leaves room for the moves' zoom.
      const nw = a.naturalWidth || a.width, nh = a.naturalHeight || a.height
      const coverW = Math.max(1, (ch / cw) / (nh / nw))
      const tw = Math.round(cw * coverW * 1.3)
      let photo: TexImageSource = a
      let pw = nw, ph = nh
      if (tw < nw * 0.92) {
        const c = document.createElement('canvas'); c.width = tw; c.height = Math.round(tw * nh / nw)
        const x = c.getContext('2d')!; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'
        x.drawImage(a, 0, 0, c.width, c.height)
        photo = c; pw = c.width; ph = c.height
      }
      tex(0, photo); tex(1, dsrc)
      const plates = depth && BEHIND_FILL ? bgPlates(a, dsrc as CanvasImageSource) : null
      tex(2, plates ? plates.color : photo); tex(3, plates ? plates.depth : b)
      const sceneTex = tex(4, null, cw, ch)
      const fbo = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.useProgram(scene)
      gl.uniform1i(gl.getUniformLocation(scene, 'img'), 0); gl.uniform1i(gl.getUniformLocation(scene, 'dep'), 1)
      gl.uniform1i(gl.getUniformLocation(scene, 'bimg'), 2); gl.uniform1i(gl.getUniformLocation(scene, 'bdep'), 3)
      gl.useProgram(lens)
      gl.uniform1i(gl.getUniformLocation(lens, 'scene'), 4)
      glRef.current = { gl, scene, lens, fbo, buf, imgW: pw, imgH: ph, edge: depth ? depthEdge(dsrc) : 0 }
      setReady(true)
    }).catch((e) => {
      // A browser that ran out of 3D slots (phones allow only a few) - the preview shows the photo
      // still instead of an error; the real render on the worker is unaffected.
      const lost = !!ref.current?.getContext('webgl')?.isContextLost?.()
      if (preview && (lost || String(e?.message || e) === 'shader')) setFlat(true)
      else console.error(e)
      release()
    })
    return () => {
      dead = true
      const g = glRef.current
      glRef.current = null
      // Free the GPU context right away - browsers only allow a handful at once.
      try { g?.gl.getExtension('WEBGL_lose_context')?.loseContext() } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, depth, cw, ch])

  useLayoutEffect(() => {
    const g = glRef.current
    if (!ready || !g) return
    const { gl, scene, lens, fbo, buf, imgW, imgH, edge } = g
    const bindQuad = (p: WebGLProgram) => {
      gl.useProgram(p); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
      const loc = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    }
    const imgAsp = imgH / imgW
    const frameAsp = H / W
    // Fill the frame (tall formats crop in) and aim at the subject.
    const cover = Math.max(1, frameAsp / imgAsp)
    // Safe move: how far the nearest edge would slide against the background on this shot's full
    // travel - sideways and from the push-in - measured on SCREEN (a tall video shows only part of the
    // photo's width, so every slide looks bigger). Over SAFE_SHIFT, the whole move is scaled down evenly.
    // The limit was tuned on tall phone videos, as a share of the frame's WIDTH - a wide frame is ~1.8x
    // wider, so the same share let close things (an armchair in front of a fireplace) stretch ~1.8x as
    // many pixels (owner 11/12: "glitching" by a fireplace in a wide video). Measured on the short side now.
    const safe = (cam.safe || SAFE_SHIFT) * Math.min(1, ch / cw)
    const safeK = (mag: number) => {
      const reach = (cam.travel || 0) * (1 / cam.zNear - 1 / cam.zFar) * edge * (cam.focal + 0.5 / mag) * mag
      return reach > safe ? safe / reach : 1
    }
    // Just enough zoom that this shot's turns and moves never run off the photo (owner 11/12: "keep
    // the original photo... not much of a zoom"; was a fixed 12% plus letterbox bars). A screen edge
    // ray turned by `a` degrees, seen from a camera moved by (x, y, back), must still land inside the
    // photo - worst case on the nearest surface (zNear).
    const r = cam.range
    const fitMag = (k: number) => {
      if (!r) return cam.crop * cover
      const grow = 1 + (r.back * k) / cam.zNear
      const fit = (half: number, screenHalf: number, a: number, off: number) => {
        const lim = Math.max(0.05, (half - (off * k) / cam.zNear) / grow)
        return screenHalf / Math.tan(Math.max(0.05, Math.atan(lim) - (a * Math.PI) / 180))
      }
      const need = Math.max(fit(0.5 / cam.focal, 0.5 / cam.focal, r.pan, r.x),
                            fit(imgAsp * 0.5 / cam.focal, frameAsp * 0.5 / cam.focal, r.tilt, r.y)) * 1.01
      return Math.max(cam.crop * cover, need)
    }
    let k = safeK(fitMag(safeK(cam.crop * cover * 1.06)))
    const need = fitMag(k)
    k = Math.min(k, safeK(need))
    const pos: [number, number, number] = [cam.pos[0] * k, cam.pos[1] * k, cam.pos[2] * k]
    // The push-in that was cut comes back as a gentle lens zoom (no parallax, so nothing can
    // stretch) - half of it, from the shot's start: a full one read as zooming, not walking in.
    const back = r ? r.back : 0
    const crop = (need / cover) * (1 + (1 - k) * Math.max(0, cam.pos[2] + back) * 0.5) * (cam.zoom || 1)
    // aiming at the subject uses only the room the turns don't need
    const maxShift = Math.max(0, 0.5 / need - 0.5 / (crop * cover) - 0.004)
    const shift = Math.max(-maxShift, Math.min(maxShift, (cam.focusX ?? 0.5) - 0.5))
    const baseYaw = (Math.atan(shift / cam.focal) * 180) / Math.PI

    const measure = !!preview && pq.level < PREVIEW_LEVELS.length - 1 && pq.measured <= 90 && draws.current++ > 1
    const t0 = measure ? performance.now() : 0
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.viewport(0, 0, cw, ch)
    bindQuad(scene)
    const u = (n: string) => gl.getUniformLocation(scene, n)
    gl.uniform1f(u('imgAsp'), imgAsp); gl.uniform1f(u('frameAsp'), frameAsp); gl.uniform2f(u('texel'), 1 / imgW, 1 / imgH)
    gl.uniform3f(u('C'), pos[0], pos[1], pos[2]); gl.uniform3f(u('rot'), cam.yaw + baseYaw, cam.pitch, cam.roll)
    gl.uniform1f(u('f'), cam.focal); gl.uniform1f(u('fOut'), cam.focal * crop * cover)
    gl.uniform1f(u('zN'), cam.zNear); gl.uniform1f(u('zF'), cam.zFar); gl.uniform1f(u('steps'), preview ? lite.steps : 72)
    gl.uniform1f(u('gapMin'), 6 / (cw * crop * cover))
    gl.uniform1f(u('t'), cam.time); gl.uniform1f(u('lightsOn'), cam.lightsOn); gl.uniform1f(u('flick'), cam.flicker)
    gl.uniform4f(u('fx'), cam.lights, cam.water, cam.sky, cam.sway)
    const fb = cam.fire && cam.fireBox && cam.fireBox.length === 4 ? cam.fireBox : null
    gl.uniform1f(u('fire'), fb ? cam.fire || 0 : 0)
    gl.uniform4f(u('fbox'), fb ? fb[0] : 0, fb ? fb[1] : 0, fb ? fb[2] : 0, fb ? fb[3] : 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, cw, ch)
    bindQuad(lens)
    const v = (n: string) => gl.getUniformLocation(lens, n)
    const scale = dpr * (Math.min(W, H) / 1080)
    gl.uniform2f(v('px'), 1 / cw, 1 / ch); gl.uniform1f(v('focus'), cam.focus); gl.uniform1f(v('ap'), cam.aperture)
    gl.uniform1f(v('dpr'), scale); gl.uniform1f(v('t'), cam.time); gl.uniform1f(v('exposure'), cam.exposure)
    gl.uniform1f(v('hq'), preview ? 0 : 1); gl.uniform2f(v('streak'), cam.streak[0], cam.streak[1])
    gl.uniform1f(v('radial'), cam.radial); gl.uniform1f(v('black'), cam.black)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    if (!preview) gl.finish()
    else if (measure) {
      gl.finish()
      // test switch (QA only): window.__ohpPreviewSlowTest = extra ms per draw, to act like a weak phone
      const extra = Number((window as unknown as { __ohpPreviewSlowTest?: number }).__ohpPreviewSlowTest) || 0
      notePreviewDraw(performance.now() - t0 + extra)
    }
    release()
  })

  useEffect(() => {
    const c = ref.current
    if (!c || !preview) return
    const onLost = (e: Event) => { e.preventDefault(); setFlat(true) }
    c.addEventListener('webglcontextlost', onLost)
    return () => c.removeEventListener('webglcontextlost', onLost)
  }, [preview, cw, ch])

  if (flat) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={res(src)} alt="" style={{ width: W, height: H, display: 'block', objectFit: 'cover', ...style }} />
  }
  // keyed by size: a lighter preview level gets a brand-new canvas (the old one's 3D context was
  // released and can't be reused - it would drop to the flat photo)
  return <canvas key={`${cw}x${ch}`} ref={ref} width={cw} height={ch} style={{ width: W, height: H, display: 'block', ...style }} />
}
