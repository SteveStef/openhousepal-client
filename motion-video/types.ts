// Cinematic Video (AI Media) - everything one video is made of. The same props drive the live
// preview in the browser (@remotion/player) and the final render on the video worker
// (video-worker/server.mjs), so what the agent previews is exactly what downloads.
// Keep this folder free of Next.js / "@/" imports: the worker bundles it on its own.

export type MotionTheme = 'classic' | 'luxe'
export type MotionStyleId = 'cinematic' | 'glide' | 'bold'
export type TransitionId = 'cut' | 'crossfade' | 'dip' | 'light' | 'whip' | 'zoom'
export type CameraMove = 'auto' | 'push' | 'slide_left' | 'slide_right' | 'rise' | 'orbit' | 'drone'
export type PhotoKind =
  | 'exterior' | 'aerial' | 'pool' | 'outdoor' | 'living' | 'kitchen' | 'dining' | 'bedroom'
  | 'bathroom' | 'office' | 'interior' | 'detail'
export type MotionFormat = '16:9' | '9:16' | '1:1' | '4:5'
// bright / elegant = real tracks (owner 11/12). piano / ambient = the old placeholder names, still
// accepted from saved projects and played as elegant / bright (musicFile).
export type MotionMusic = 'bright' | 'elegant' | 'none' | 'piano' | 'ambient'
export const musicFile = (m: MotionMusic) => (m === 'piano' ? 'elegant' : m === 'ambient' ? 'bright' : m)
export type MotionMetal = 'gold' | 'silver' | 'bronze'
export type MotionSituation =
  | 'just_listed' | 'coming_soon' | 'open_house' | 'price_improved' | 'under_contract' | 'just_sold'
  | 'back_on_market' | 'new_construction' | 'private_listing' | 'custom'

export type MotionPhoto = {
  id: string
  /** What gets drawn: the sharpened copy, else the cleaned copy, else the original. */
  src: string
  /** Depth map (bright = near). Missing = the photo still moves, just without 3D depth. */
  depth?: string | null
  kind: PhotoKind
  /** The caption on the video ("Pool & Gardens"). */
  label: string
  /** Small line above the caption ("Outdoors"). */
  kicker?: string
  showLabel: boolean
  move: CameraMove
  /** Where the subject sits left-right (0..1) - keeps it in frame in tall formats. */
  focusX?: number
  /** What the photo has, for the living touches: warm lights, water, sky, trees. */
  lights?: boolean
  water?: boolean
  sky?: boolean
  trees?: boolean
  /** A lit fire (fireplace, fire pit): its flames flicker. fireBox = [left, top, right, bottom], 0-1 of the photo. */
  fire?: boolean
  fireBox?: number[] | null
  /** The depth map has crisp edges (Marigold) - the camera may move further (SAFE_SHIFT_SHARP). */
  sharpDepth?: boolean
  /** The transition INTO this photo (unset = the video's own). */
  transitionIn?: TransitionId | null
  /** Taken out of the video (kept in the project so it can come back). */
  hidden?: boolean
}

export type MotionSections = {
  opening: boolean
  labels: boolean
  stats: boolean
  agent: 'off' | 'opening' | 'always'
  endCard: boolean
}

export type MotionFacts = {
  address: string
  cityLine: string
  price?: string
  wasPrice?: string
  beds?: string
  baths?: string
  sqft?: string
  acres?: string
  /** Open house day & time line. */
  when?: string
  /** "Listing courtesy of ..." when the agent isn't the listing agent. */
  courtesy?: string
}

export type MotionAgentInfo = {
  name: string
  brokerage?: string
  phone?: string
  email?: string
  photo?: string | null
}

export type MotionCopy = {
  /** Opening kicker override (default comes from the situation). */
  kicker?: string
  /** Opening line under the address. */
  tagline?: string
  /** Custom situation title. */
  title?: string
  /** End card call to action. */
  cta?: string
}

export type MotionProps = {
  photos: MotionPhoto[]
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
  /** Length the agent picked, in seconds (15/30/45/60). Unset = the style's own pace. */
  length?: number | null
  /** In-browser preview: lighter shader so phones keep up. */
  preview?: boolean
  /** Test only (local example renders): override the no-warp limit. Never set by the app. */
  safeShift?: number
  /** Test only: drawing cost knobs for the final render (3D march steps, highlight-glow samples). */
  perf?: { steps?: number; glow?: number; dil?: number }
  /** Where static files (fonts, music) live - '' in the app, the worker's own server otherwise. */
  assetBase?: string
}

// Owner 11/12: smoother, more fluid camera motion - 30 (was 24, the film rate; 30 is what phones and
// social apps play natively). All timing is in seconds, so nothing else changes; ~25% longer render.
export const FPS = 30

/** Built-in files (example photos, music) are written as "/motion/..." and resolved by the
 *  caller's staticFile so they load in both the app and the worker. */
export const isBuiltIn = (src?: string | null) => !!src && src.startsWith('/motion/')

export const FORMAT_SIZE: Record<MotionFormat, { w: number; h: number; label: string }> = {
  '16:9': { w: 1920, h: 1080, label: 'Landscape' },
  '9:16': { w: 1080, h: 1920, label: 'Vertical' },
  '1:1': { w: 1080, h: 1080, label: 'Square' },
  '4:5': { w: 1080, h: 1350, label: 'Portrait' },
}
