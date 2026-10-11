import { DesignBlock, DesignFormatDef, DesignStyle, DesignStyleId, LinkedProperty } from '@/types'

// Exactly 4 real visual template styles - deliberately capped here, not a growing list.
// Each is a distinct system (badge shape / dividers / type transform), not a palette swap on one
// layout - color (light/dark/brand) is a fully independent axis, see lib/studio/designColors.ts.
// Modern Luxury is the flagship style for this phase: it should read as genuinely appropriate for
// a $3M-$10M listing, since it sets the ceiling for how premium the whole product feels.
export const DESIGN_STYLES: DesignStyle[] = [
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Magazine serif with an italic kicker - warm and timeless.',
    tokens: { addressFont: 'serif', badgeShape: 'pill', dividerStyle: 'hairline', labelTransform: 'none', priceEmphasis: 'accent', density: 'generous', solidColorBlock: false },
  },
  {
    id: 'modern_luxury',
    label: 'Modern Luxury',
    description: 'Fine serif caps, hairline frames, centered calm - for high-end listings.',
    tokens: { addressFont: 'serif', badgeShape: 'sharp', dividerStyle: 'accent-rule', labelTransform: 'uppercase-tracked', priceEmphasis: 'serif-large', density: 'generous', solidColorBlock: false },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean modern grotesk, quiet and precise - the photo does the talking.',
    tokens: { addressFont: 'sans', badgeShape: 'scrim', dividerStyle: 'hairline', labelTransform: 'uppercase-tracked', priceEmphasis: 'accent', density: 'generous', solidColorBlock: false },
  },
  {
    id: 'bold',
    label: 'Bold',
    description: 'Condensed poster type on solid color blocks - built to stop the scroll.',
    tokens: { addressFont: 'sans', badgeShape: 'sharp', dividerStyle: 'thick-border', labelTransform: 'none', priceEmphasis: 'serif-large', density: 'compact', solidColorBlock: true },
  },
]

export function getStyle(styleId: string): DesignStyle {
  return DESIGN_STYLES.find(s => s.id === styleId) || DESIGN_STYLES[0]
}

// Realistic placeholder listing used to render live thumbnails in the style picker and the
// Templates dashboard - so an agent sees what a style actually looks like before choosing it,
// instead of a text label or a flat color swatch.
export const PLACEHOLDER_PROPERTY: LinkedProperty = {
  address: '412 Ridgemont Drive',
  city: 'Bryn Mawr',
  state: 'PA',
  zipcode: '19010',
  price: 3495000,
  close_price: 3420000, // sample sale price - only Just Sold previews use it ("Sold for")
  beds: 5,
  baths: 4.5,
  sqft: 5200,
  lot_size: 52000,
  year_built: 2019,
  property_type: 'Single Family',
  image_url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=60',
  photos: [
    'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=60',
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=60',
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=60',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=60',
  ],
  description: 'A meticulously renovated estate blending classic architecture with modern luxury, set on over an acre of manicured grounds.',
  status: 'ACTIVE',
}

export const DEFAULT_FACT_FIELDS = ['beds', 'baths', 'sqft'] as const
export const ADDABLE_FACT_FIELDS: { key: string; label: string }[] = [
  { key: 'beds', label: 'Beds' },
  { key: 'baths', label: 'Baths' },
  { key: 'sqft', label: 'Sq Ft' },
  { key: 'lot_size', label: 'Lot Size' },
  { key: 'year_built', label: 'Year Built' },
  { key: 'property_type', label: 'Property Type' },
]

// Narrow, real starter catalog. More formats/styles land in later passes -
// each of these renders as an actual structured, exportable design (not a placeholder).
export const DESIGN_FORMATS: DesignFormatDef[] = [
  {
    designType: 'just_listed_flyer',
    label: 'Just Listed Flyer',
    category: 'Property Marketing',
    description: 'A full-page print flyer with multiple photos and a written property description.',
    aspectRatio: 8.5 / 11,
    orientation: 'portrait',
    defaultStyleId: 'editorial',
    layout: 'grid',
    isPrint: true,
    qrByDefault: true,
  },
  {
    designType: 'property_mailer',
    label: 'Mailer',
    category: 'Print',
    description: 'A photo-collage mailer postcard built to send to your farm area.',
    aspectRatio: 6 / 4,
    orientation: 'landscape',
    defaultStyleId: 'editorial',
    layout: 'grid',
    isPrint: true,
    qrByDefault: true,
  },
  {
    designType: 'open_house_flyer',
    label: 'Open House Flyer',
    category: 'Property Marketing',
    description: 'A print flyer with open house date, time, photos, and details.',
    aspectRatio: 8.5 / 11,
    orientation: 'portrait',
    defaultStyleId: 'editorial',
    layout: 'grid',
    isPrint: true,
    qrByDefault: true,
  },
  {
    designType: 'postcard',
    label: 'Postcard',
    category: 'Print',
    description: 'A landscape mailer postcard for farming or listing announcements.',
    aspectRatio: 6 / 4,
    orientation: 'landscape',
    defaultStyleId: 'editorial',
    layout: 'grid',
    isPrint: true,
    qrByDefault: true,
  },
  {
    designType: 'postcard_jumbo',
    label: 'Jumbo Postcard',
    category: 'Print',
    description: 'The oversized 9 x 6 mailer most agents use for farming - more room for the photo.',
    aspectRatio: 9 / 6,
    orientation: 'landscape',
    defaultStyleId: 'editorial',
    layout: 'grid',
    isPrint: true,
    qrByDefault: true,
  },
  {
    designType: 'letter_mailer',
    label: 'Letter Mailer',
    category: 'Print',
    description: 'A full letter-size (8.5 x 11) page to mail or hand out.',
    aspectRatio: 8.5 / 11,
    orientation: 'portrait',
    defaultStyleId: 'editorial',
    layout: 'grid',
    isPrint: true,
    qrByDefault: true,
  },
  {
    designType: 'door_hanger',
    label: 'Door Hanger',
    category: 'Print',
    description: 'A tall, narrow piece built for door-to-door neighborhood distribution.',
    aspectRatio: 4.25 / 11,
    orientation: 'portrait',
    defaultStyleId: 'editorial',
    layout: 'grid',
    isPrint: true,
    qrByDefault: true,
  },
  {
    designType: 'just_sold_post',
    label: 'Just Sold Post',
    category: 'Social Media',
    description: 'A square social post celebrating a closed sale.',
    aspectRatio: 1,
    orientation: 'square',
    defaultStyleId: 'editorial',
    layout: 'poster',
    isPrint: false,
    qrByDefault: false,
  },
  {
    designType: 'instagram_post',
    label: 'Square Post',
    category: 'Social Media',
    description: 'The classic 1:1 Instagram & Facebook post.',
    aspectRatio: 1,
    orientation: 'square',
    defaultStyleId: 'editorial',
    layout: 'poster',
    isPrint: false,
    qrByDefault: false,
  },
  {
    designType: 'instagram_portrait',
    label: 'Feed Post',
    category: 'Social Media',
    description: 'The tall 4:5 feed size - works on Instagram, Facebook and LinkedIn, and for ads. Fills more of the screen.',
    aspectRatio: 4 / 5,
    orientation: 'portrait',
    defaultStyleId: 'editorial',
    layout: 'poster',
    isPrint: false,
    qrByDefault: false,
  },
  {
    designType: 'instagram_story',
    label: 'Instagram Story',
    category: 'Social Media',
    description: 'A full-screen vertical story for a listing or open house.',
    aspectRatio: 9 / 16,
    orientation: 'portrait',
    defaultStyleId: 'editorial',
    layout: 'poster',
    isPrint: false,
    qrByDefault: false,
  },
  // Retired from the pickers 10/09 (user: keep Studio simple - the 4:5 Feed Post covers Facebook and
  // LinkedIn). Kept here only so designs saved in these sizes still open, edit and export.
  {
    designType: 'facebook_post',
    label: 'Facebook Post',
    category: 'Social Media',
    description: 'A landscape image post sized for Facebook.',
    aspectRatio: 1.91,
    orientation: 'landscape',
    defaultStyleId: 'editorial',
    layout: 'poster',
    isPrint: false,
    qrByDefault: false,
  },
  {
    designType: 'linkedin_post',
    label: 'LinkedIn Post',
    category: 'Social Media',
    description: 'A landscape image post sized for LinkedIn.',
    aspectRatio: 1.91,
    orientation: 'landscape',
    defaultStyleId: 'editorial',
    layout: 'poster',
    isPrint: false,
    qrByDefault: false,
  },
  {
    designType: 'email_graphic',
    label: 'Email Graphic',
    category: 'Digital',
    description: 'A wide branded header or banner to drop into an email campaign.',
    aspectRatio: 3,
    orientation: 'landscape',
    defaultStyleId: 'editorial',
    layout: 'split',
    isPrint: false,
    qrByDefault: false,
  },
  {
    designType: 'presentation_graphic',
    label: 'Presentation Graphic',
    category: 'Digital',
    description: 'A polished, wide graphic for a listing presentation or meeting deck.',
    aspectRatio: 16 / 9,
    orientation: 'landscape',
    defaultStyleId: 'editorial',
    layout: 'poster',
    isPrint: false,
    qrByDefault: false,
  },
]

// Where each format is actually used, and the exact size it's produced at - drives the wizard's
// "Where will it be posted?" step and the export size (server PNG export mirrors `exportPx` in
// backend/app/services/design_export_service.py, print PDFs use the physical `size`).
export const DESIGN_FORMAT_META: Record<string, { channel: 'Social' | 'Print' | 'Digital'; placement: string; size: string; exportPx: [number, number] }> = {
  instagram_post: { channel: 'Social', placement: 'Instagram & Facebook feed · 1:1', size: '1080 × 1080 px', exportPx: [1080, 1080] },
  instagram_portrait: { channel: 'Social', placement: 'Instagram, Facebook & LinkedIn feed · ads · 4:5', size: '1080 × 1350 px', exportPx: [1080, 1350] },
  just_sold_post: { channel: 'Social', placement: 'Instagram & Facebook feed', size: '1080 × 1080 px', exportPx: [1080, 1080] },
  instagram_story: { channel: 'Social', placement: 'Stories & Reels cover', size: '1080 × 1920 px', exportPx: [1080, 1920] },
  facebook_post: { channel: 'Social', placement: 'Facebook feed & link posts', size: '1200 × 628 px', exportPx: [1200, 628] },
  linkedin_post: { channel: 'Social', placement: 'LinkedIn feed', size: '1200 × 628 px', exportPx: [1200, 628] },
  just_listed_flyer: { channel: 'Print', placement: 'Letter-size flyer', size: '8.5 × 11 in', exportPx: [2550, 3300] },
  open_house_flyer: { channel: 'Print', placement: 'Letter-size flyer', size: '8.5 × 11 in', exportPx: [2550, 3300] },
  postcard: { channel: 'Print', placement: 'Standard mailing size', size: '6 × 4 in', exportPx: [1800, 1200] },
  postcard_jumbo: { channel: 'Print', placement: 'Oversized - most used for farming', size: '9 × 6 in', exportPx: [2700, 1800] },
  letter_mailer: { channel: 'Print', placement: 'Letter-size page', size: '8.5 × 11 in', exportPx: [2550, 3300] },
  property_mailer: { channel: 'Print', placement: 'Photo mailer', size: '6 × 4 in', exportPx: [1800, 1200] },
  door_hanger: { channel: 'Print', placement: 'Door hanger', size: '4.25 × 11 in', exportPx: [1275, 3300] },
  email_graphic: { channel: 'Digital', placement: 'Email header banner', size: '1800 × 600 px', exportPx: [1800, 600] },
  presentation_graphic: { channel: 'Digital', placement: 'Slides & screens', size: '1920 × 1080 px', exportPx: [1920, 1080] },
}

export function getDesignFormat(designType: string): DesignFormatDef | undefined {
  return DESIGN_FORMATS.find(f => f.designType === designType)
}

let blockCounter = 0
// Exported so other template builders (lib/studio/designTemplates.ts) generate ids from the same
// counter/format, rather than risking id collisions between two independent counters.
export function blockId(prefix: string): string {
  blockCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${blockCounter}`
}

// Generic, format-level default block stack - used as the fallback Template (see
// lib/studio/designTemplates.ts) whenever a dedicated (situation, format) template doesn't exist
// yet, so the Template picker is never empty. A real, opinionated starting layout (not an empty
// canvas). When a property is passed, blocks that can be pre-filled from real listing data are
// (e.g. the description block starts with the property's actual remarks, still fully editable)
// rather than leaving the agent to retype what OpenHousePal already knows.
export function buildGenericDefaultBlocks(designType: string, property?: LinkedProperty | null): DesignBlock[] {
  const hero: DesignBlock = { id: blockId('hero'), type: 'hero_photo', hidden: false, data: {}, overrides: {} }
  const gallery: DesignBlock = { id: blockId('gallery'), type: 'photo_gallery', hidden: false, data: { selectedPhotos: [] }, overrides: {} }
  const facts = (): DesignBlock => ({ id: blockId('facts'), type: 'facts', hidden: false, data: { fields: [...DEFAULT_FACT_FIELDS] }, overrides: {} })
  const description = (): DesignBlock => ({ id: blockId('description'), type: 'description', hidden: false, data: { text: property?.description || '' }, overrides: {} })
  const headline = (text: string): DesignBlock => ({ id: blockId('headline'), type: 'headline', hidden: false, data: { text }, overrides: {} })
  const address: DesignBlock = { id: blockId('address'), type: 'address', hidden: false, data: {}, overrides: {} }
  const price: DesignBlock = { id: blockId('price'), type: 'price', hidden: false, data: {}, overrides: {} }
  const agent: DesignBlock = { id: blockId('agent'), type: 'agent_info', hidden: false, data: {}, overrides: {} }
  // Format-aware, not per-case guesswork - print formats get a QR by default, social/digital ones
  // don't (see DesignFormatDef.qrByDefault).
  const format = getDesignFormat(designType)
  const qr = (target: string, label: string): DesignBlock[] => (format?.qrByDefault ? [{ id: blockId('qr'), type: 'qr_code' as const, hidden: false, data: { target, label }, overrides: {} }] : [])

  switch (designType) {
    case 'just_listed_flyer':
      return [hero, gallery, headline('Just Listed'), address, price, facts(), description(), { id: blockId('highlights'), type: 'highlights', hidden: false, data: { items: [] }, overrides: {} }, agent, ...qr('property', 'Scan for Details')]
    case 'property_mailer':
    case 'letter_mailer':
      return [hero, gallery, headline('Just Listed'), address, price, description(), agent, ...qr('property', 'Scan for Details')]
    case 'open_house_flyer':
      return [hero, gallery, headline('Open House'), address, { id: blockId('openhouse'), type: 'open_house_details', hidden: false, data: {}, overrides: {} }, facts(), description(), agent, ...qr('open_house_registration', 'Register for the Open House')]
    case 'door_hanger':
      return [hero, headline('Just Listed'), address, price, facts(), agent, ...qr('property', 'Scan for Details')]
    case 'postcard':
    case 'postcard_jumbo':
      return [hero, gallery, headline('Just Listed'), address, price, facts(), agent, ...qr('property', 'Scan for Details')]
    case 'just_sold_post':
      return [hero, headline('Just Sold'), address, price, agent]
    case 'instagram_story':
      return [hero, headline('Just Listed'), address, price, ...qr('property', 'Swipe Up')]
    case 'facebook_post':
    case 'linkedin_post':
      return [hero, headline('Just Listed'), address, price, facts(), agent]
    case 'email_graphic':
      return [hero, headline('Just Listed'), address, price, agent]
    case 'presentation_graphic':
      return [hero, headline('Just Listed'), address, price, facts(), description(), agent]
    case 'instagram_post':
    case 'instagram_portrait':
    default:
      return [hero, headline('New Listing'), address, price, facts(), agent]
  }
}

export const ADDABLE_DESIGN_BLOCK_TYPES: { type: DesignBlock['type']; label: string }[] = [
  { type: 'headline', label: 'Headline' },
  { type: 'address', label: 'Address' },
  { type: 'price', label: 'Price' },
  { type: 'facts', label: 'Property Facts' },
  { type: 'open_house_details', label: 'Open House Details' },
  { type: 'description', label: 'Description' },
  { type: 'highlights', label: 'Feature Highlights' },
  { type: 'photo_gallery', label: 'Photo Gallery' },
  { type: 'agent_info', label: 'Agent Info' },
  { type: 'brokerage_branding', label: 'Brokerage Branding' },
  { type: 'qr_code', label: 'QR Code' },
  { type: 'cta', label: 'Call to Action' },
]
