// Cinematic Video presets: situations (premade flows), animation styles, transitions, camera
// moves and per-room defaults. Shared by the video itself and the editor's pickers.
import type {
  CameraMove, MotionCopy, MotionFacts, MotionPhoto, MotionSections, MotionSituation, MotionStyleId,
  PhotoKind, TransitionId,
} from './types'

export type SituationPreset = {
  id: MotionSituation
  label: string
  blurb: string
  /** Opening kicker, by theme. */
  kicker: string
  luxeKicker: string
  /** End card: small line, then the big line. */
  endKicker: string
  endBig: (f: MotionFacts) => string
  cta: string
  /** Asks for the open-house time / the old price. */
  needs?: 'when' | 'was'
  showPrice: boolean
  sections?: Partial<MotionSections>
}

const priceOr = (f: MotionFacts, fallback: string) => (f.price ? f.price : fallback)

export const SITUATION_PRESETS: SituationPreset[] = [
  { id: 'just_listed', label: 'Just Listed', blurb: 'Announce a brand-new listing', kicker: 'Just listed', luxeKicker: 'Introducing', endKicker: 'Offered at', endBig: f => priceOr(f, 'Now available'), cta: 'Schedule a private showing', showPrice: true },
  { id: 'coming_soon', label: 'Coming Soon', blurb: 'Build buzz before it hits the market', kicker: 'Coming soon', luxeKicker: 'Privately previewing', endKicker: 'Coming soon', endBig: () => 'Be the First', cta: 'Ask me for early access', showPrice: false },
  { id: 'open_house', label: 'Open House', blurb: 'Day and time, front and center', kicker: 'Open house', luxeKicker: 'The pleasure of your company', endKicker: 'Open house', endBig: f => f.when || 'This weekend', cta: 'Stop by - I would love to show you around', needs: 'when', showPrice: false },
  { id: 'price_improved', label: 'Price Improved', blurb: 'The new price, with the old one crossed out', kicker: 'Price improved', luxeKicker: 'A refined offering', endKicker: 'New price', endBig: f => priceOr(f, 'New price'), cta: 'Schedule a private showing', needs: 'was', showPrice: true },
  { id: 'under_contract', label: 'Under Contract', blurb: 'Celebrate the accepted offer', kicker: 'Under contract', luxeKicker: 'Under contract', endKicker: 'Offer accepted', endBig: () => 'Under Contract', cta: 'Thinking of selling? Let\'s talk', showPrice: false },
  { id: 'just_sold', label: 'Just Sold', blurb: 'Close the story in style', kicker: 'Just sold', luxeKicker: 'Successfully represented', endKicker: 'Just sold', endBig: () => 'Sold', cta: 'Thinking of selling? Let\'s talk', showPrice: false },
  { id: 'back_on_market', label: 'Back on Market', blurb: 'A second chance for buyers', kicker: 'Back on the market', luxeKicker: 'Available once more', endKicker: 'Back on the market', endBig: f => priceOr(f, 'Available now'), cta: 'Schedule a private showing', showPrice: true },
  { id: 'new_construction', label: 'New Construction', blurb: 'Fresh, crisp, brand-new', kicker: 'New construction', luxeKicker: 'Newly crafted', endKicker: 'Offered at', endBig: f => priceOr(f, 'Now available'), cta: 'Schedule a private tour', showPrice: true },
  { id: 'private_listing', label: 'Private Listing', blurb: 'Off-market, shared by invitation', kicker: 'Private listing', luxeKicker: 'A private offering', endKicker: 'Private offering', endBig: () => 'By Appointment', cta: 'Contact me for details', showPrice: false, sections: { stats: true } },
  { id: 'custom', label: 'Custom', blurb: 'Your own words', kicker: 'Featured property', luxeKicker: 'Featured residence', endKicker: 'Featured property', endBig: f => priceOr(f, 'Now available'), cta: 'Schedule a private showing', showPrice: true },
]
export const situationPreset = (id?: string | null) => SITUATION_PRESETS.find(s => s.id === id) || SITUATION_PRESETS[0]

export type StylePreset = {
  id: MotionStyleId
  label: string
  blurb: string
  /** Seconds per photo, the first photo, and how far the camera travels. */
  shot: number
  first: number
  moveScale: number
  defaultTransition: TransitionId
}
export const STYLE_PRESETS: StylePreset[] = [
  { id: 'cinematic', label: 'Cinematic', blurb: 'Slow, real camera moves through each room - like a film crew shot it', shot: 5.4, first: 6.4, moveScale: 1, defaultTransition: 'cut' },
  { id: 'glide', label: 'Glide', blurb: 'Softer, dreamier motion that melts from room to room', shot: 6, first: 7, moveScale: 0.8, defaultTransition: 'crossfade' },
  { id: 'bold', label: 'Bold', blurb: 'Quicker and punchier - made for Reels and TikTok', shot: 4, first: 5, moveScale: 1.3, defaultTransition: 'whip' },
]
export const stylePreset = (id?: string | null) => STYLE_PRESETS.find(s => s.id === id) || STYLE_PRESETS[0]

export type TransitionPreset = { id: TransitionId; label: string; blurb: string; seconds: number }
export const TRANSITION_PRESETS: TransitionPreset[] = [
  { id: 'cut', label: 'Clean cut', blurb: 'Straight to the next room - the way films are edited', seconds: 0 },
  { id: 'crossfade', label: 'Crossfade', blurb: 'One room gently melts into the next', seconds: 1.1 },
  { id: 'dip', label: 'Dip to black', blurb: 'A soft fade through black - calm and classic', seconds: 1.0 },
  { id: 'light', label: 'Light leak', blurb: 'A warm flare of light carries you across', seconds: 1.3 },
  { id: 'whip', label: 'Whip pan', blurb: 'A quick sideways swish - energetic', seconds: 0.42 },
  { id: 'zoom', label: 'Zoom through', blurb: 'Push forward and land in the next room', seconds: 0.55 },
]
export const transitionPreset = (id?: string | null) => TRANSITION_PRESETS.find(t => t.id === id) || TRANSITION_PRESETS[0]

export const MOVE_LABELS: { id: CameraMove; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'push', label: 'Push in' },
  { id: 'slide_left', label: 'Slide left' },
  { id: 'slide_right', label: 'Slide right' },
  { id: 'rise', label: 'Rise up' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'drone', label: 'Drone drift' },
]

export const KIND_LABELS: { id: PhotoKind; label: string; kicker: string }[] = [
  { id: 'exterior', label: 'Front of home', kicker: 'Curb appeal' },
  { id: 'aerial', label: 'Aerial view', kicker: 'From above' },
  { id: 'pool', label: 'Pool', kicker: 'Outdoors' },
  { id: 'outdoor', label: 'Yard & outdoors', kicker: 'Outdoors' },
  { id: 'living', label: 'Living room', kicker: 'Living' },
  { id: 'kitchen', label: 'Kitchen', kicker: 'The kitchen' },
  { id: 'dining', label: 'Dining room', kicker: 'Entertaining' },
  { id: 'bedroom', label: 'Bedroom', kicker: 'Retreat' },
  { id: 'bathroom', label: 'Bathroom', kicker: 'Spa-like' },
  { id: 'office', label: 'Office / den', kicker: 'Work from home' },
  { id: 'interior', label: 'Other room', kicker: 'Inside' },
  { id: 'detail', label: 'Detail / close-up', kicker: 'The details' },
]
export const kindLabel = (k?: string | null) => KIND_LABELS.find(x => x.id === k) || KIND_LABELS[10]

const EXTERIOR_KINDS: PhotoKind[] = ['exterior', 'aerial', 'pool', 'outdoor']
export const isExteriorKind = (k: PhotoKind) => EXTERIOR_KINDS.includes(k)

/** What an agent can choose to show, in the order the video walks through the home (front door in,
 *  outdoors after, a view from above to finish). Keep in step with ROOMS in the backend's
 *  studio_motion_service.py. */
export type RoomKey =
  | 'front' | 'entry' | 'living' | 'family' | 'kitchen' | 'dining' | 'office' | 'primary' | 'primary_bath'
  | 'bedroom' | 'bath' | 'basement' | 'bonus' | 'yard' | 'pool' | 'view' | 'back' | 'aerial' | 'detail'
export const ROOM_OPTIONS: { id: RoomKey; label: string; kind: PhotoKind; one: string }[] = [
  { id: 'front', label: 'Front of the home', kind: 'exterior', one: 'the front of the home' },
  { id: 'entry', label: 'Entry & foyer', kind: 'interior', one: 'the entry' },
  { id: 'living', label: 'Living room', kind: 'living', one: 'the living room' },
  { id: 'family', label: 'Family room', kind: 'living', one: 'the family room' },
  { id: 'kitchen', label: 'Kitchen', kind: 'kitchen', one: 'the kitchen' },
  { id: 'dining', label: 'Dining room', kind: 'dining', one: 'the dining room' },
  { id: 'office', label: 'Office', kind: 'office', one: 'the office' },
  { id: 'primary', label: 'Primary bedroom', kind: 'bedroom', one: 'the primary bedroom' },
  { id: 'primary_bath', label: 'Primary bath', kind: 'bathroom', one: 'the primary bath' },
  { id: 'bedroom', label: 'Bedrooms', kind: 'bedroom', one: 'a bedroom' },
  { id: 'bath', label: 'Bathrooms', kind: 'bathroom', one: 'a bathroom' },
  { id: 'basement', label: 'Basement', kind: 'interior', one: 'the basement' },
  { id: 'bonus', label: 'Bonus spaces', kind: 'interior', one: 'a bonus space' },
  { id: 'detail', label: 'Details', kind: 'detail', one: 'a detail' },
  { id: 'yard', label: 'Backyard & patio', kind: 'outdoor', one: 'the backyard' },
  { id: 'pool', label: 'Pool', kind: 'pool', one: 'the pool' },
  { id: 'view', label: 'Views & grounds', kind: 'outdoor', one: 'the grounds' },
  { id: 'back', label: 'Back of the home', kind: 'exterior', one: 'the back of the home' },
  { id: 'aerial', label: 'Aerial view', kind: 'aerial', one: 'the view from above' },
]
export const roomOption = (id?: string | null) => ROOM_OPTIONS.find(r => r.id === id) || null

export const DEFAULT_SECTIONS: MotionSections = { opening: true, labels: true, stats: true, agent: 'opening', endCard: true }

export function defaultCopy(): MotionCopy { return {} }

/** "auto" -> the move that suits this room, alternating directions so cuts feel edited. */
export function resolveMove(p: MotionPhoto, index: number): Exclude<CameraMove, 'auto'> {
  if (p.move && p.move !== 'auto') return p.move
  const alt = index % 2 === 0
  switch (p.kind) {
    case 'exterior': return index === 0 ? 'rise' : alt ? 'orbit' : 'push'
    case 'aerial': return 'drone'
    case 'pool':
    case 'outdoor': return alt ? 'slide_right' : 'slide_left'
    case 'kitchen':
    case 'bedroom':
    case 'detail': return 'push'
    case 'dining': return 'rise'
    case 'living':
    case 'office':
    case 'bathroom':
    case 'interior':
    default: return alt ? 'slide_left' : 'slide_right'
  }
}
