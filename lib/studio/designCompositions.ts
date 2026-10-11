import { DesignBlock, DesignFormatDef, DesignTemplateLayoutHints } from '@/types'

// A Composition is the actual art direction of a design - where the photo sits, how the type is
// set against it, what leads. Every composition adapts itself to every format family below, so a
// template is just "(situation, format) -> composition + starter content" and a Style/Color change
// never moves anything around.
export type DesignCompositionId =
  | 'cinematic' // full-bleed photo, type set over a tinted scrim (print portrait: cover + info band)
  | 'horizon' // cinematic, set low - price beside the facts in one row so more of the home shows
  | 'framed' // solid page, photo inset like a gallery print, type below/beside it
  | 'split' // photo edge-to-edge on one side, a solid type panel on the other
  | 'collage' // print: hero plus supporting photos, the complete listing story
  | 'statement' // typography-led - the message itself is the hero, photo is secondary
  | 'band' // a solid headline band (news + place), photo edge to edge, a facts band beneath
  | 'card' // full-bleed photo with a crisp information card floating over it
  | 'magazine' // a cover: masthead across the photo, cover lines, the agent as byline
  | 'mosaic' // a hero plus supporting shots in a tight grid, the story in a band
  | 'seal' // full-bleed photo with a round stamp - the news inside, the address on the rim
  | 'luxe' // OpenHousePal Luxe (IDX): the photo framed in gold light, a midnight plate with the story
  | 'keepsake' // social: the photo as a taped instant print on soft paper, a handwritten headline
  | 'billboard' // social: giant poster type, the photo as a card over it, a ticker of the facts
  | 'slant' // social: full-bleed photo, a diagonal color slab, a round price sticker
  | 'postage' // the photo as a perforated stamp with a postmark, "Greetings from" the town, airmail border
  | 'filmstrip' // three photos on a tilted strip of film, the headline set big
  // QR-led mailers - built around the scan (print only; social sizes fall back to Billboard)
  | 'ticket' // an admission ticket - photo + pitch, the QR on the perforated stub
  | 'pricetag' // a paper price tag hanging over the photo with the number and the QR
  | 'scango' // the QR beside a phone showing the exact form it opens, 1-2-3 steps
  | 'bullseye' // the QR at the center of a "scan me" target on the photo's edge
  | 'note' // a neighbor's note on lined paper, the QR on a sticky note
  | 'reveal' // a metallic scratch-off panel hiding the number, the QR to reveal it
  // Social / email / slide art directions (2026-10-08)
  | 'arch' // the photo in a tall arched window with an accent outline, keystone and sill; calm centered type
  | 'swiss' // International-style poster: the news huge in a heavy grotesk, hard photo block, ruled data table

export type DesignFamily = 'square' | 'story' | 'portrait' | 'tall' | 'landscape' | 'banner'

// Luxe pieces (the Luxe layout or the Luxe color theme) are IDX only - other plans can preview them.
export const LUXE_COMPOSITION: DesignCompositionId = 'luxe'
// A Luxe finish ("dark@gold") counts too - see splitColorMode in designColors.ts.
export const isLuxeDesign = (composition?: string | null, colorMode?: string | null) => composition === 'luxe' || (colorMode || '').split('@')[0] === 'luxe' || (colorMode || '').includes('@')

export function formatFamily(format: Pick<DesignFormatDef, 'aspectRatio'> & { isPrint?: boolean }): DesignFamily {
  const ar = format.aspectRatio
  // The 4:5 feed/ad size is a taller square post, not a flyer - it keeps the social compositions.
  if (format.isPrint === false && ar >= 0.72 && ar < 0.9) return 'square'
  if (ar < 0.45) return 'tall'
  if (ar < 0.7) return 'story'
  if (ar < 0.9) return 'portrait'
  if (ar <= 1.1) return 'square'
  if (ar < 2.4) return 'landscape'
  return 'banner'
}

export const COMPOSITION_LABELS: Record<DesignCompositionId, { label: string; description: string }> = {
  cinematic: { label: 'Cinematic', description: 'The photo fills the frame, type set over it.' },
  horizon: { label: 'Horizon', description: 'Full photo, details set low - price beside the facts.' },
  framed: { label: 'Gallery Frame', description: 'The photo inset like a fine-art print.' },
  split: { label: 'Split', description: 'Photo on one side, a clean type panel on the other.' },
  collage: { label: 'Collage', description: 'A hero photo plus supporting shots - the full story.' },
  statement: { label: 'Statement', description: 'The message leads - bold, typographic.' },
  band: { label: 'Headline Band', description: 'A bold band with the news, the photo edge to edge.' },
  card: { label: 'Floating Card', description: 'The photo fills the frame, details on a crisp card.' },
  luxe: { label: 'Luxe', description: 'The OpenHousePal signature - framed in gold light, set on midnight.' },
  magazine: { label: 'Magazine Cover', description: 'A masthead across the photo, like a cover.' },
  mosaic: { label: 'Mosaic', description: 'A hero shot plus supporting photos in a tight grid.' },
  seal: { label: 'Seal', description: 'A stamped seal with the news - the address on its rim.' },
  keepsake: { label: 'Keepsake', description: 'An instant photo print, taped down, with a handwritten headline.' },
  billboard: { label: 'Billboard', description: 'Giant poster type, the photo on top, the facts on a ticker.' },
  slant: { label: 'Slant', description: 'A bold diagonal slab and a price sticker over the photo.' },
  postage: { label: 'Postage', description: 'The home as a stamp with a postmark - "Greetings from" your town.' },
  filmstrip: { label: 'Filmstrip', description: 'Three photos on a strip of film, the headline set big.' },
  ticket: { label: 'Ticket', description: 'An admission ticket - the QR on the tear-off stub.' },
  pricetag: { label: 'Price Tag', description: 'A paper tag hanging over the photo with the number and the QR.' },
  scango: { label: 'Scan & Go', description: 'The QR beside a phone showing the form it opens - 1, 2, 3.' },
  bullseye: { label: 'Bullseye', description: 'The QR at the center of a "scan me" target.' },
  note: { label: 'Neighbor Note', description: 'A note on lined paper, signed by you, the QR on a sticky note.' },
  reveal: { label: 'Scratch & Reveal', description: 'A scratch-off panel hides the number - scan to reveal it.' },
  arch: { label: 'Arch', description: 'The home in a tall arched window, framed in a fine accent line.' },
  swiss: { label: 'Swiss', description: 'Huge grotesk type, a hard-edged photo and the numbers in a ruled table.' },
}

// Designs saved before compositions existed only stored layout hints (poster/grid/split) via their
// template id. Maps those onto the closest composition so every old design keeps its general
// arrangement but renders with the new art direction - no data migration needed.
export function compositionFromLegacy(hints: DesignTemplateLayoutHints | undefined, format: DesignFormatDef, blocks?: DesignBlock[]): DesignCompositionId {
  const layout = hints?.layout || format.layout
  if (layout === 'poster') return 'cinematic'
  if (layout === 'split') return 'split'
  const hasGallery = !!blocks?.some(b => b.type === 'photo_gallery' && !b.hidden)
  if (format.isPrint && hasGallery) return 'collage'
  return 'framed'
}
