import { DesignBlock, DesignTemplateLayoutHints, LinkedProperty } from '@/types'
import { blockId, getDesignFormat } from '@/lib/studio/designFormats'
import { DESIGN_SITUATIONS, DesignMessagingVariant, DesignSituationId, getSituation } from '@/lib/studio/designSituations'
import { COMPOSITION_LABELS, DesignCompositionId, formatFamily } from '@/lib/studio/designCompositions'

// Every (situation, format) pair a situation lists gets 3 hand-directed templates. A template is
// an art direction (composition, see DesignCanvas.tsx) plus opinionated starter content for that
// situation - Style and Color are independent axes chosen afterwards, and never move anything.

export interface TemplateBuildOptions {
  heroPhoto?: string | null // the photo the agent picked in the wizard (property or library/upload)
  openHouseDate?: string
  openHouseTime?: string
  openHouseEventId?: string | null
  qrTarget?: string // e.g. 'form:home-value' - resolved by the wizard from the agent's real forms
  headline?: string // lead-gen: a custom headline typed in the wizard
  // Price on the design: the listing's own price (list price, or the sale price on Just Sold),
  // a price the agent types in, or none at all.
  priceMode?: 'listing' | 'manual' | 'hidden'
  manualPrice?: string
  previousPrice?: string // Price Improvement: the "was" price, when the agent types one
  hideStreet?: boolean // show the town instead of the street address
  hideNumber?: boolean // show the street without its house number ("Ridgemont Drive, Gladwyne")
  qrLabel?: string // the QR caption when the wizard pointed it at one of the agent's forms
  qrHidden?: boolean // print piece without a QR code (the agent turned it off in the wizard)
  hideAgentPhoto?: boolean // the agent switched their headshot off in the wizard (the editor's 'You' card has the same switch)
}

export interface DesignTemplateDef {
  id: string
  situationId: DesignSituationId | 'any'
  designType: string
  label: string
  description: string
  composition: DesignCompositionId
  // Coarse poster/grid/split description of the composition - kept so anything that only
  // understands the older layout vocabulary (e.g. the homepage demo's layout thumbnails) still works.
  layoutHints?: DesignTemplateLayoutHints
  buildBlocks: (property?: LinkedProperty | null, messaging?: DesignMessagingVariant, options?: TemplateBuildOptions) => DesignBlock[]
}

function block(type: DesignBlock['type'], data: Record<string, any> = {}, extra: Partial<DesignBlock> = {}): DesignBlock {
  return { id: blockId(type), type, hidden: false, data, overrides: {}, ...extra }
}

export const SITUATION_HEADLINES: Record<string, string> = {
  just_listed: 'Just Listed',
  coming_soon: 'Coming Soon',
  open_house: 'Open House',
  price_improvement: 'New Price',
  under_contract: 'Under Contract',
  just_sold: 'Just Sold',
}

const LAYOUT_HINTS: Record<DesignCompositionId, DesignTemplateLayoutHints> = {
  cinematic: { layout: 'poster', contentAnchor: 'bottom' },
  horizon: { layout: 'poster', contentAnchor: 'bottom' },
  framed: { layout: 'grid', photoHeightPct: 58 },
  split: { layout: 'split', splitSide: 'right' },
  collage: { layout: 'grid', photoHeightPct: 64 },
  statement: { layout: 'split', splitSide: 'right' },
  band: { layout: 'grid', photoHeightPct: 64 },
  card: { layout: 'poster', contentAnchor: 'bottom' },
  magazine: { layout: 'poster', contentAnchor: 'top' },
  mosaic: { layout: 'grid', photoHeightPct: 70 },
  seal: { layout: 'poster', contentAnchor: 'bottom' },
  luxe: { layout: 'poster', contentAnchor: 'bottom' },
  keepsake: { layout: 'split', splitSide: 'right' },
  billboard: { layout: 'poster', contentAnchor: 'top' },
  slant: { layout: 'poster', contentAnchor: 'bottom' },
  postage: { layout: 'split', splitSide: 'right' },
  filmstrip: { layout: 'grid', photoHeightPct: 50 },
  ticket: { layout: 'poster', contentAnchor: 'bottom' },
  pricetag: { layout: 'poster', contentAnchor: 'bottom' },
  scango: { layout: 'split', splitSide: 'right' },
  bullseye: { layout: 'split', splitSide: 'left' },
  note: { layout: 'poster', contentAnchor: 'top' },
  reveal: { layout: 'split', splitSide: 'right' },
  arch: { layout: 'split', splitSide: 'left' },
  swiss: { layout: 'grid', photoHeightPct: 50 },
}

// The 3 art directions each (situation, placement) offers - hand-picked so the three are genuinely
// different from each other AND from the neighbouring situations, and the photo always leads.
// Keyed by situation, then by placement group (see placementGroup below).
type PlacementGroup = 'square' | 'sold_post' | 'story' | 'social_wide' | 'deck' | 'print_wide' | 'flyer' | 'hanger' | 'email'
const C = (...ids: DesignCompositionId[]) => ids
const PROPERTY_PICKS: Record<string, Partial<Record<PlacementGroup, DesignCompositionId[]>>> = {
  just_listed: {
    square: C('cinematic', 'band', 'mosaic'), story: C('cinematic', 'mosaic', 'band'), social_wide: C('cinematic', 'mosaic', 'band'),
    deck: C('cinematic', 'mosaic', 'card'), print_wide: C('band', 'collage', 'mosaic'), flyer: C('band', 'mosaic', 'magazine'), email: C('split', 'band', 'cinematic'),
  },
  coming_soon: {
    square: C('magazine', 'card', 'band'), story: C('magazine', 'cinematic', 'card'), social_wide: C('magazine', 'card', 'cinematic'),
    print_wide: C('band', 'split', 'collage'), email: C('cinematic', 'band', 'split'),
  },
  open_house: {
    square: C('card', 'cinematic', 'seal'), story: C('card', 'band', 'cinematic'), social_wide: C('card', 'band', 'cinematic'),
    print_wide: C('band', 'collage', 'split'), flyer: C('card', 'band', 'mosaic'), hanger: C('band', 'cinematic', 'statement'),
  },
  price_improvement: {
    square: C('band', 'seal', 'card'), story: C('seal', 'band', 'card'), social_wide: C('band', 'seal', 'card'),
    print_wide: C('band', 'split', 'collage'),
  },
  under_contract: {
    square: C('seal', 'cinematic', 'mosaic'), story: C('seal', 'magazine', 'cinematic'), social_wide: C('seal', 'cinematic', 'mosaic'),
    print_wide: C('band', 'collage', 'split'),
  },
  just_sold: {
    square: C('cinematic', 'band', 'seal'), sold_post: C('band', 'magazine', 'mosaic'), story: C('cinematic', 'band', 'magazine'),
    social_wide: C('band', 'seal', 'cinematic'), print_wide: C('band', 'collage', 'split'), hanger: C('band', 'cinematic', 'collage'),
  },
}
const LEAD_GEN_PICKS: Partial<Record<PlacementGroup, DesignCompositionId[]>> = {
  square: C('cinematic', 'card', 'band'), story: C('cinematic', 'card', 'band'), social_wide: C('cinematic', 'card', 'band'),
  print_wide: C('cinematic', 'band', 'split'), hanger: C('statement', 'cinematic', 'framed'), email: C('cinematic', 'split', 'statement'),
}

function placementGroup(designType: string): PlacementGroup {
  const format = getDesignFormat(designType)
  if (designType === 'just_sold_post') return 'sold_post'
  if (designType === 'presentation_graphic') return 'deck'
  const fam = format ? formatFamily(format) : 'square'
  if (fam === 'story') return 'story'
  if (fam === 'portrait') return 'flyer'
  if (fam === 'tall') return 'hanger'
  if (fam === 'banner') return 'email'
  if (fam === 'landscape') return format?.isPrint ? 'print_wide' : 'social_wide'
  return 'square'
}

// Horizon (the low, price-beside-facts take on Cinematic) is offered right after Cinematic on
// every social placement of a listing situation.
function withHorizon(ids: DesignCompositionId[], group: PlacementGroup): DesignCompositionId[] {
  if (!['square', 'story', 'social_wide', 'sold_post'].includes(group) || ids.includes('horizon')) return ids
  const at = ids.indexOf('cinematic')
  return at >= 0 ? [...ids.slice(0, at + 1), 'horizon', ...ids.slice(at + 1)] : [...ids, 'horizon']
}

// Floating Card is retired from new designs (old ones still open and render as saved) - its slot
// goes to the next art direction that isn't already offered. Luxe (IDX) closes every list.
const BACKFILL: DesignCompositionId[] = ['cinematic', 'band', 'magazine', 'seal', 'mosaic', 'split']
// The signature set (Keepsake, Billboard, Slant, Postage, Filmstrip) is on every Instagram /
// Facebook / Story list and every mailer, flyer and door hanger, in the same order everywhere - so
// a post, its Story and the postcard of one listing can all be the same design. On print pieces and
// lead magnets the set leads the list; on listing social posts it follows the classics.
const SIGNATURE_SET: DesignCompositionId[] = ['keepsake', 'billboard', 'slant', 'postage', 'filmstrip']
const SET_GROUPS: PlacementGroup[] = ['square', 'sold_post', 'story', 'social_wide', 'print_wide', 'flyer', 'hanger', 'email', 'deck']
// The QR-led mailers - every mailer and door hanger is there to get a scan. They lead the list on
// "get more leads" mail pieces, and follow the signature set on listing mailers.
const QR_SET: DesignCompositionId[] = ['ticket', 'pricetag', 'scango', 'bullseye', 'note', 'reveal']
const PRINT_GROUPS: PlacementGroup[] = ['print_wide', 'flyer', 'hanger']
// Arch + Swiss: on every social size, the email header and the slide, right after the signature set.
const SCREEN_SET: DesignCompositionId[] = ['arch', 'swiss']
const SCREEN_GROUPS: PlacementGroup[] = ['square', 'sold_post', 'story', 'social_wide', 'email', 'deck']
function finalize(ids: DesignCompositionId[], group?: PlacementGroup, setFirst = false): DesignCompositionId[] {
  const out: DesignCompositionId[] = ids.filter(id => id !== 'card')
  for (const id of BACKFILL) {
    if (out.length >= Math.min(ids.length, 4)) break
    if (!out.includes(id)) out.push(id)
  }
  const set = group && SET_GROUPS.includes(group) ? SIGNATURE_SET : []
  const print = !!group && PRINT_GROUPS.includes(group)
  const qr = print ? QR_SET : []
  const screen = group && SCREEN_GROUPS.includes(group) ? SCREEN_SET : []
  const rest = out.filter(id => !set.includes(id) && !screen.includes(id))
  if (print && setFirst) return [...qr, ...set, ...rest, 'luxe']
  if (print) return [...set, ...qr, ...rest, 'luxe']
  const lead = setFirst
  return lead ? [...set, ...screen, ...rest, 'luxe'] : [...rest, ...set, ...screen, 'luxe']
}

export function compositionsFor(situationId: string, designType: string): DesignCompositionId[] {
  const situation = getSituation(situationId)
  const group = placementGroup(designType)
  if (situation && !situation.propertyAttached) return finalize(LEAD_GEN_PICKS[group] || LEAD_GEN_PICKS.square!, group, true)
  const picks = PROPERTY_PICKS[situationId] || PROPERTY_PICKS.just_listed
  return finalize(withHorizon(picks[group] || PROPERTY_PICKS.just_listed[group] || C('cinematic', 'band', 'card'), group), group)
}

function propertyBlocks(situationId: string, designType: string, composition: DesignCompositionId, property: LinkedProperty | null | undefined, options: TemplateBuildOptions = {}): DesignBlock[] {
  const format = getDesignFormat(designType)
  const fam = format ? formatFamily(format) : 'square'
  const isPrint = !!format?.isPrint
  const blocks: DesignBlock[] = []

  const hero = block('hero_photo')
  const defaultHero = property?.photos?.[0] || property?.image_url || null
  if (options.heroPhoto && options.heroPhoto !== defaultHero) hero.overrides = { image_url: options.heroPhoto }
  blocks.push(hero)

  const wantsGallery = composition === 'collage' || composition === 'mosaic' || composition === 'filmstrip' || (composition === 'keepsake' && (fam === 'portrait' || fam === 'tall')) || (composition === 'band' && isPrint && fam !== 'landscape') || (composition === 'framed' && (fam === 'portrait' || fam === 'tall'))
  if (wantsGallery) blocks.push(block('photo_gallery', { selectedPhotos: [], autoFillCount: 3 }))

  blocks.push(block('headline', { text: SITUATION_HEADLINES[situationId] || 'Just Listed' }))
  blocks.push(block('address', options.hideStreet ? { hideStreet: true } : options.hideNumber ? { hideNumber: true } : {}))
  // Every listing situation shows a price (Just Sold: "Sold for" the sale price when known,
  // "Listed at" otherwise) unless the agent chose to leave it off in the wizard.
  const mode = options.priceMode || 'listing'
  const manual = mode === 'manual' && (options.manualPrice || '').trim()
  const price = block('price', mode === 'manual' ? { priceSource: 'manual' } : {}, { hidden: mode === 'hidden' })
  if (manual) price.overrides = { ...price.overrides, price: manual }
  if (options.previousPrice?.trim()) price.overrides = { ...price.overrides, previousPrice: options.previousPrice.trim() }
  blocks.push(price)

  if (situationId === 'open_house') {
    blocks.push(block('open_house_details', {
      date: options.openHouseDate || '',
      time: options.openHouseTime || '',
      ...(options.openHouseEventId ? { open_house_event_id: options.openHouseEventId } : {}),
    }))
  }

  const richFacts = fam === 'portrait' || designType === 'presentation_graphic'
  blocks.push(block('facts', { fields: richFacts ? ['beds', 'baths', 'sqft', 'lot_size'] : ['beds', 'baths', 'sqft'] }))

  const wantsDescription = fam === 'portrait' || designType === 'presentation_graphic' || (fam === 'tall' && composition !== 'statement') || (composition === 'slant' && (designType === 'instagram_portrait' || designType === 'instagram_story'))
  if (wantsDescription) blocks.push(block('description', { text: property?.description || '' }))
  if (fam === 'portrait' && composition === 'collage') blocks.push(block('highlights', { items: [] }))

  blocks.push(block('agent_info', options.hideAgentPhoto ? { hidePhoto: true } : {}))
  if (isPrint) {
    const qr = options.qrTarget
      ? block('qr_code', { target: options.qrTarget, label: options.qrLabel || 'Scan to learn more' })
      : situationId === 'open_house'
        ? block('qr_code', { target: 'open_house_registration', label: 'Scan to register' })
        : block('qr_code', { target: 'property', label: 'Scan for details' })
    if (options.qrHidden) qr.hidden = true
    blocks.push(qr)
  }
  return blocks
}

function leadGenBlocks(situationId: string, designType: string, messaging: DesignMessagingVariant | undefined, options: TemplateBuildOptions = {}, composition?: DesignCompositionId): DesignBlock[] {
  const situation = getSituation(situationId)
  const format = getDesignFormat(designType)
  const copy = situation?.leadGenCopy
  const variant = messaging || situation?.messagingVariants?.[0]
  const hero = block('hero_photo')
  const photo = options.heroPhoto ?? situation?.photoLibrary?.[0] ?? null
  if (photo) hero.overrides = { image_url: photo }
  const blocks: DesignBlock[] = [
    hero,
    block('headline', {
      text: options.headline?.trim() || variant?.headline || situation?.label || '',
      eyebrow: copy?.eyebrow || '',
      subtext: variant?.subtext || copy?.subtext || '',
    }),
    block('cta', { label: copy?.cta || 'Get Started' }),
    block('agent_info', options.hideAgentPhoto ? { hidePhoto: true } : {}),
  ]
  if (format?.isPrint) blocks.push(block('qr_code', { target: options.qrTarget || 'agent_hub', label: options.qrLabel || copy?.qrLabel || 'Scan to get started' }, { hidden: !!options.qrHidden }))
  // Multi-photo layouts on a lead magnet: the situation's other library photos fill the extra frames.
  const fam = format ? formatFamily(format) : 'square'
  if (composition === 'filmstrip' || (composition === 'keepsake' && (fam === 'portrait' || fam === 'tall'))) {
    const extra = (situation?.photoLibrary || []).filter(u => u !== photo).slice(0, 3)
    if (extra.length) blocks.splice(1, 0, block('photo_gallery', { selectedPhotos: extra, autoFillCount: 3 }))
  }
  return blocks
}

function makeTemplate(situationId: DesignSituationId, designType: string, composition: DesignCompositionId, layoutOverride?: DesignTemplateLayoutHints): DesignTemplateDef {
  const situation = getSituation(situationId)
  const meta = COMPOSITION_LABELS[composition]
  return {
    id: `${situationId}__${designType}__${composition}`,
    situationId,
    designType,
    label: meta.label,
    description: meta.description,
    composition,
    layoutHints: layoutOverride || LAYOUT_HINTS[composition],
    buildBlocks: (property, messaging, options) => situation?.propertyAttached === false
      ? leadGenBlocks(situationId, designType, messaging, options, composition)
      : propertyBlocks(situationId, designType, composition, property, options),
  }
}

export const DESIGN_TEMPLATES: DesignTemplateDef[] = DESIGN_SITUATIONS.flatMap(situation =>
  situation.formats.flatMap(designType => compositionsFor(situation.id, designType).map(comp => makeTemplate(situation.id, designType, comp))),
)

export function getTemplatesFor(situationId: string, designType: string): DesignTemplateDef[] {
  const real = DESIGN_TEMPLATES.filter(t => t.situationId === situationId && t.designType === designType)
  if (real.length) return real
  // A format a situation doesn't curate (only reachable through old links) - still never empty.
  return compositionsFor(situationId, designType).map(comp => ({ ...makeTemplate('just_listed', designType, comp), id: `generic__${designType}__${comp}`, situationId: 'any' as const }))
}

export function getRealTemplatesForFormat(designType: string): DesignTemplateDef[] {
  return DESIGN_TEMPLATES.filter(t => t.designType === designType)
}

// Template ids saved before compositions existed (e.g. `just_sold__instagram_post__full_bleed_top`,
// `generic__postcard`) resolve to the closest composition so every old design opens, renders and
// exports with the new art direction - its blocks/content are untouched.
const LEGACY_KEYS: Record<string, { composition: DesignCompositionId; hints?: DesignTemplateLayoutHints }> = {
  full_bleed_top: { composition: 'cinematic' },
  bold_overlay: { composition: 'cinematic' },
  full_bleed: { composition: 'cinematic' },
  three_quarter: { composition: 'framed' },
  photo_led: { composition: 'collage' },
  photo_forward: { composition: 'framed' },
  photo_first: { composition: 'collage' },
  collage: { composition: 'collage' },
  details_forward: { composition: 'collage' },
  message_forward: { composition: 'statement' },
  split_bold: { composition: 'split' },
  split: { composition: 'split' },
  split_right: { composition: 'split' },
  split_left: { composition: 'split', hints: { layout: 'split', splitSide: 'left' } },
  single_photo: { composition: 'split' },
  neighborhood: { composition: 'split' },
}

const COMPOSITION_IDS = new Set<string>(['cinematic', 'horizon', 'framed', 'split', 'collage', 'statement', 'band', 'card', 'magazine', 'mosaic', 'seal', 'luxe', 'keepsake', 'billboard', 'slant', 'postage', 'filmstrip', 'ticket', 'pricetag', 'scango', 'bullseye', 'note', 'reveal', 'arch', 'swiss'])

export function getTemplate(templateId: string): DesignTemplateDef | undefined {
  const exact = DESIGN_TEMPLATES.find(t => t.id === templateId)
  if (exact) return exact
  const parts = templateId.split('__')
  if (parts[0] === 'generic') {
    const designType = parts[1]
    const format = getDesignFormat(designType)
    if (!format) return undefined
    const comp = (parts[2] && COMPOSITION_IDS.has(parts[2]) ? parts[2] : (format.layout === 'poster' ? 'cinematic' : format.layout === 'split' ? 'split' : format.isPrint ? 'collage' : 'framed')) as DesignCompositionId
    return { ...makeTemplate('just_listed', designType, comp), id: templateId, situationId: 'any' }
  }
  if (parts.length === 3) {
    const [situationId, designType, key] = parts
    const situation = getSituation(situationId)
    if (!situation || !getDesignFormat(designType)) return undefined
    if (COMPOSITION_IDS.has(key)) return { ...makeTemplate(situation.id, designType, key as DesignCompositionId), id: templateId }
    const legacy = LEGACY_KEYS[key]
    if (legacy) return { ...makeTemplate(situation.id, designType, legacy.composition, legacy.hints), id: templateId }
  }
  return undefined
}
