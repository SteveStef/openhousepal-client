'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Calendar, Check, Crop, EyeOff, ImageIcon, Maximize2, Move, Plus, RotateCcw, Sparkles, Type, X, ZoomIn } from 'lucide-react'
import type { AgentFormConfig, BrandKit, CampaignLookup, DesignBlock, DesignColorMode, DesignProject, DesignStyleId, LinkedProperty, OpenHouse } from '@/types'
import type { DesignAgentInfo } from '@/lib/studio/designAgent'
import type { DesignCanvasContext } from '../DesignCanvas'
import type { DesignCompositionId, DesignFamily } from '@/lib/studio/designCompositions'
import type { DesignFormatDef } from '@/types'
import { ADDABLE_FACT_FIELDS, DEFAULT_FACT_FIELDS, blockId } from '@/lib/studio/designFormats'
import { SITUATION_HEADLINES } from '@/lib/studio/designTemplates'
import { AiWriteButton, ComplianceChips } from '@/components/ai/AiWriteButton'
import { Card, Chips, Field, Note, PhotoTile, ResetLink, Seg, Toggle, UploadTile, digitsOnly, inputCls, labelCls, money, prettyDigits, useDraftValue } from './ui'
import YourHomesPhotos from './YourHomesPhotos'
import api from '@/lib/api-service'

// ---------------------------------------------------------------------------------------------
// What every card gets: the design, the handful of block operations, and what the layout can
// hold. Cards only ever show controls for things that exist (or can be added) in THIS design.
// ---------------------------------------------------------------------------------------------
export type CardId = 'photo' | 'words' | 'details' | 'you' | 'look' | 'property' | 'leads'

export interface Reposition { target: 'hero' | string } // 'hero' or a gallery photo URL

export interface EditorCtl {
  design: DesignProject
  blocks: DesignBlock[]
  property: LinkedProperty | null
  situation: string | null
  leadGen: boolean
  format: DesignFormatDef
  fam: DesignFamily
  composition: DesignCompositionId
  agent: DesignAgentInfo
  brandKit: BrandKit | null
  agentForms: AgentFormConfig[]
  linkedOpenHouses: OpenHouse[]
  libraryPhotos: string[]
  updateBlock: (id: string, updater: (b: DesignBlock) => DesignBlock) => void
  addBlock: (block: DesignBlock) => void
  removeBlock: (id: string) => void
  reposition: Reposition | null
  setReposition: (r: Reposition | null) => void
  /** The field the agent clicked in the preview (block id) - the matching input gets focus. */
  focusBlockId: string | null
  /** The exact context the preview renders with - the Look card's thumbnails reuse it. */
  ctx: DesignCanvasContext
  isIdx: boolean
  setBrandingMode: (mode: DesignProject['branding_mode']) => void
  changeLook: (patch: { template_id?: string; style_id?: DesignStyleId; color_mode?: DesignColorMode }) => void
  openPropertyPicker: () => void
  resetToListing: () => void
  campaignInfo: CampaignLookup | null
  trackingUrl: string | null
  changeCampaign: (id: string | null) => void
}

export const find = (blocks: DesignBlock[], type: DesignBlock['type']) => blocks.find(b => b.type === type)

const setData = (ctl: EditorCtl, id: string, patch: Record<string, any>) => ctl.updateBlock(id, b => ({ ...b, data: { ...b.data, ...patch } }))
const setOverride = (ctl: EditorCtl, id: string, key: string, value: any) => ctl.updateBlock(id, b => {
  const next = { ...b.overrides }
  if (value === undefined || value === null || value === '') delete next[key]
  else next[key] = value
  return { ...b, overrides: next }
})
const setHidden = (ctl: EditorCtl, id: string, hidden: boolean) => ctl.updateBlock(id, b => ({ ...b, hidden }))

export function propertyPhotos(property: LinkedProperty | null): string[] {
  if (!property) return []
  const list = property.photos?.length ? property.photos : (property.image_url ? [property.image_url] : [])
  return Array.from(new Set(list.filter(Boolean) as string[]))
}

// Which layouts hold supporting photos, and how many.
export function galleryCapacity(composition: DesignCompositionId, fam: DesignFamily, isPrint: boolean): number {
  if (composition === 'mosaic') return fam === 'portrait' ? 3 : 2
  if (composition === 'collage') return fam === 'portrait' || fam === 'tall' ? 3 : 2
  if (composition === 'band' && isPrint && (fam === 'portrait' || fam === 'tall')) return fam === 'tall' ? 2 : 3
  if (composition === 'framed' && (fam === 'portrait' || fam === 'tall')) return fam === 'tall' ? 2 : 3
  return 0
}

export function supportsDescription(fam: DesignFamily, designType: string, composition: DesignCompositionId): boolean {
  if (designType === 'presentation_graphic') return true
  if (fam === 'portrait') return true
  if (fam === 'tall') return composition !== 'statement'
  if (composition === 'slant' && (designType === 'instagram_portrait' || designType === 'instagram_story')) return true
  return false
}

// ---------------------------------------------------------------------------------------------
// Photo
// ---------------------------------------------------------------------------------------------
export function PhotoCard({ ctl, open, onToggle, flash }: { ctl: EditorCtl; open: boolean; onToggle: () => void; flash: boolean }) {
  const hero = find(ctl.blocks, 'hero_photo')
  const gallery = find(ctl.blocks, 'photo_gallery')
  const listingPhotos = propertyPhotos(ctl.property)
  const defaultMain = listingPhotos[0] || null
  const currentHero: string | null = hero ? (hero.overrides?.image_url ?? defaultMain ?? (ctl.leadGen ? ctl.libraryPhotos[0] || null : null)) : null
  const [uploads, setUploads] = useState<string[]>([])
  // The photo grid shows the first few; "Show more" opens the rest (the sample library is ~20).
  const [showAllPhotos, setShowAllPhotos] = useState(false)
  const choices = useMemo(() => {
    const extra = hero?.overrides?.image_url && ![...listingPhotos, ...ctl.libraryPhotos].includes(hero.overrides.image_url) ? [hero.overrides.image_url as string] : []
    return Array.from(new Set([...uploads, ...extra, ...listingPhotos, ...ctl.libraryPhotos]))
  }, [uploads, hero?.overrides?.image_url, listingPhotos, ctl.libraryPhotos])

  const focal = hero?.data?.photoFocalPoint || { x: 50, y: 50 }
  const zoom: number = hero?.data?.photoZoom ?? 1
  const fit: boolean = !!hero?.data?.photoFit
  const capacity = galleryCapacity(ctl.composition, ctl.fam, ctl.format.isPrint)
  const selectedGallery: string[] = gallery?.data?.selectedPhotos || []
  const positions: Record<string, { x?: number; y?: number; zoom?: number }> = gallery?.data?.photoPositions || {}
  const repositioning = ctl.reposition
  const target = repositioning?.target || 'hero'
  const targetPos = target === 'hero' ? { x: focal.x, y: focal.y, zoom } : { x: positions[target]?.x ?? 50, y: positions[target]?.y ?? 50, zoom: positions[target]?.zoom ?? 1 }

  const setMain = (url: string) => {
    if (!hero) return
    ctl.updateBlock(hero.id, b => {
      const overrides = { ...b.overrides }
      if (url === defaultMain) delete overrides.image_url
      else overrides.image_url = url
      // A new photo starts centered - the old crop belonged to the old picture.
      return { ...b, overrides, data: { ...b.data, photoFocalPoint: undefined, photoZoom: undefined, photoFit: undefined } }
    })
  }
  const setTargetPos = (patch: { x?: number; y?: number; zoom?: number; fit?: boolean }) => {
    if (target === 'hero') {
      if (!hero) return
      ctl.updateBlock(hero.id, b => ({ ...b, data: {
        ...b.data,
        ...(patch.x !== undefined || patch.y !== undefined ? { photoFocalPoint: { x: Math.round(patch.x ?? focal.x), y: Math.round(patch.y ?? focal.y) } } : {}),
        ...(patch.zoom !== undefined ? { photoZoom: Math.round(patch.zoom * 100) / 100 } : {}),
        ...(patch.fit !== undefined ? { photoFit: patch.fit } : {}),
      } }))
    } else if (gallery) {
      ctl.updateBlock(gallery.id, b => ({ ...b, data: { ...b.data, photoPositions: { ...b.data?.photoPositions, [target]: { ...b.data?.photoPositions?.[target], ...(patch.x !== undefined ? { x: Math.round(patch.x) } : {}), ...(patch.y !== undefined ? { y: Math.round(patch.y) } : {}), ...(patch.zoom !== undefined ? { zoom: Math.round(patch.zoom * 100) / 100 } : {}) } } } }))
    }
  }
  const toggleGallery = (url: string) => {
    if (!gallery) return
    const on = selectedGallery.includes(url)
    const next = on ? selectedGallery.filter(p => p !== url) : [...selectedGallery, url].slice(0, capacity)
    setData(ctl, gallery.id, { selectedPhotos: next })
    if (on && repositioning?.target === url) ctl.setReposition(null)
  }
  const moveGallery = (from: number, dir: -1 | 1) => {
    if (!gallery) return
    const to = from + dir
    if (to < 0 || to >= selectedGallery.length) return
    const next = [...selectedGallery]
    const [m] = next.splice(from, 1)
    next.splice(to, 0, m)
    setData(ctl, gallery.id, { selectedPhotos: next })
  }
  const addGallery = () => ctl.addBlock({ id: blockId('photo_gallery'), type: 'photo_gallery', hidden: false, data: { selectedPhotos: [], autoFillCount: capacity }, overrides: {} })
  const cropped = targetPos.x !== 50 || targetPos.y !== 50 || targetPos.zoom !== 1 || (target === 'hero' && fit)

  return (
    <Card icon={ImageIcon} title={ctl.leadGen ? 'Photo' : 'Photos'} hint={currentHero ? 'Swap the main photo, re-frame it, add more' : 'Add a photo'} open={open} onToggle={onToggle} flash={flash}>
      {hero && !ctl.property && (
        <YourHomesPhotos current={currentHero} onPick={(main, more) => { setUploads(u => Array.from(new Set([...more, ...u]))); setMain(main) }} />
      )}
      {hero && (
        <div>
          <p className={labelCls}>{ctl.property ? 'Main photo' : 'Or pick a photo'}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-400">{ctl.property ? 'Tap any listing photo to make it the main one.' : ctl.leadGen ? 'A photo chosen for this message - or use your own.' : 'Upload a photo for this design.'}</p>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            <UploadTile onUploaded={url => { setUploads(u => [url, ...u]); setMain(url) }} />
            {ctl.leadGen && (
              <button type="button" onClick={() => hero && ctl.updateBlock(hero.id, b => ({ ...b, overrides: { ...b.overrides, image_url: '' } }))} className={`flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border-2 text-[11px] font-black transition ${hero.overrides?.image_url === '' ? 'border-[#C9A24D] bg-[#C9A24D]/[0.06] text-[#8b7355]' : 'border-gray-200 text-gray-400 hover:border-gray-300 dark:border-white/10'}`}>
                <EyeOff className="h-5 w-5" /> No photo
              </button>
            )}
            {(showAllPhotos || choices.length <= 9 ? choices : choices.slice(0, 8).concat(currentHero && choices.indexOf(currentHero) >= 8 ? [currentHero] : [])).map(url => (
              <PhotoTile
                key={url} src={url} selected={currentHero === url} label={currentHero === url ? 'Main' : undefined}
                onClick={() => setMain(url)}
                starred={capacity > 0 && !!gallery && selectedGallery.includes(url)}
                onStar={capacity > 0 && gallery && url !== currentHero ? () => toggleGallery(url) : undefined}
                starTitle={selectedGallery.includes(url) ? 'Remove from the extra photos' : 'Add as an extra photo'}
              />
            ))}
          </div>
          {choices.length > 9 && (
            <button type="button" onClick={() => setShowAllPhotos(v => !v)}
              className="mt-2 w-full rounded-xl border border-gray-200 py-2 text-[11px] font-black text-[#8b7355] transition hover:border-[#C9A24D] dark:border-white/10 dark:text-[#d7b974]">
              {showAllPhotos ? 'Show fewer' : `Show ${choices.length - 8} more photos`}
            </button>
          )}
        </div>
      )}

      {currentHero && hero && (
        <div className="rounded-xl border border-gray-200 p-3 dark:border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#111827] dark:text-white">Framing</p>
              <p className="text-[11px] font-semibold text-gray-400">{repositioning ? 'Drag the photo in the preview to choose what shows.' : cropped ? 'Custom framing' : 'Centered on the photo'}</p>
            </div>
            {repositioning ? (
              <button type="button" onClick={() => ctl.setReposition(null)} className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3.5 py-2 text-xs font-black text-white dark:bg-white dark:text-[#111827]"><Check className="h-3.5 w-3.5" /> Done</button>
            ) : (
              <button type="button" onClick={() => ctl.setReposition({ target: 'hero' })} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-xs font-black text-[#111827] transition hover:border-[#C9A24D] dark:border-white/10 dark:text-white"><Move className="h-3.5 w-3.5" /> Adjust framing</button>
            )}
          </div>
          {repositioning && (
            <div className="mt-3 space-y-3">
              {selectedGallery.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => ctl.setReposition({ target: 'hero' })} className={`rounded-full border px-3 py-1 text-[11px] font-black ${target === 'hero' ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 text-gray-500 dark:border-white/10'}`}>Main photo</button>
                  {selectedGallery.map((url, i) => (
                    <button key={url} type="button" onClick={() => ctl.setReposition({ target: url })} className={`rounded-full border px-3 py-1 text-[11px] font-black ${target === url ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 text-gray-500 dark:border-white/10'}`}>Photo {i + 2}</button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3">
                <ZoomIn className="h-4 w-4 shrink-0 text-gray-400" />
                <input type="range" min={1} max={2.5} step={0.01} value={targetPos.zoom} onChange={e => setTargetPos({ zoom: Number(e.target.value) })} className="w-full accent-[#C9A24D]" aria-label="Zoom" disabled={target === 'hero' && fit} />
                <span className="w-11 shrink-0 text-right text-xs font-black text-[#111827] dark:text-white">{Math.round(targetPos.zoom * 100)}%</span>
              </div>
              {target === 'hero' && (
                <Toggle label="Show the whole photo" hint="Nothing cut off - the edges fill with a soft blur of it." on={fit} onChange={v => setTargetPos({ fit: v, zoom: 1 })} />
              )}
              <div className="grid grid-cols-3 gap-1.5">
                {([['Top', 50, 15], ['Center', 50, 50], ['Bottom', 50, 85], ['Left', 15, 50], ['Right', 85, 50]] as const).map(([label, x, y]) => {
                  const on = Math.round(targetPos.x) === x && Math.round(targetPos.y) === y
                  return <button key={label} type="button" onClick={() => setTargetPos({ x, y })} className={`rounded-xl border px-2 py-2 text-[11px] font-black transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>{label}</button>
                })}
                <button type="button" onClick={() => setTargetPos({ x: 50, y: 50, zoom: 1, fit: false })} className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 px-2 py-2 text-[11px] font-black text-gray-500 transition hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300"><RotateCcw className="h-3 w-3" /> Reset</button>
              </div>
              <Note><Crop className="mr-1 inline h-3 w-3 text-[#8b7355]" /> Your photo file is never cut - this only sets what shows in this design.</Note>
            </div>
          )}
        </div>
      )}

      {capacity > 0 && (
        <div>
          <div className="flex items-center justify-between">
            <p className={labelCls}>Extra photos</p>
            <span className="text-[11px] font-semibold text-gray-400">{gallery ? `${selectedGallery.length} of ${capacity}` : `This layout shows up to ${capacity} more`}</span>
          </div>
          {!gallery ? (
            <button type="button" onClick={addGallery} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3.5 py-2 text-xs font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15">
              <Plus className="h-3.5 w-3.5" /> Add extra photos
            </button>
          ) : selectedGallery.length === 0 ? (
            <p className="mt-1 text-[11px] font-semibold text-gray-400">Tap the star on any photo above to add it. Left empty, the next listing photos fill in automatically.</p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedGallery.map((url, i) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className={`h-16 w-20 rounded-lg object-cover ${repositioning?.target === url ? 'ring-[3px] ring-[#C9A24D]' : ''}`} />
                  <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 text-[9px] font-black text-white">{i + 2}</span>
                  <div className="absolute inset-x-0 bottom-0 flex justify-between p-1">
                    <button type="button" onClick={() => moveGallery(i, -1)} disabled={i === 0} className="rounded bg-white/90 px-1 text-[10px] font-black disabled:opacity-30"><ArrowLeft className="h-3 w-3" /></button>
                    <button type="button" onClick={() => toggleGallery(url)} className="rounded bg-white/90 px-1 text-[10px] font-black text-red-600"><X className="h-3 w-3" /></button>
                    <button type="button" onClick={() => moveGallery(i, 1)} disabled={i === selectedGallery.length - 1} className="rounded bg-white/90 px-1 text-[10px] font-black disabled:opacity-30"><ArrowRight className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------------------------
// Words - the headline / kicker, address lines, description, highlights, button text.
// ---------------------------------------------------------------------------------------------
const HEADLINE_IDEAS: Record<string, string[]> = {
  just_listed: ['Just Listed', 'New Listing', 'Now Available', 'Welcome Home'],
  coming_soon: ['Coming Soon', 'Sneak Peek', 'Arriving Soon'],
  open_house: ['Open House', 'Open This Weekend', 'Come See It'],
  price_improvement: ['New Price', 'Price Improvement', 'Just Reduced'],
  under_contract: ['Under Contract', 'Pending', 'Offer Accepted'],
  just_sold: ['Just Sold', 'Sold', 'Another Happy Client', 'Closed'],
}

function TextField({ label, value, onCommit, placeholder, hint, multiline, autoFocus, action }: { label: string; value: string; onCommit: (v: string) => void; placeholder?: string; hint?: string; multiline?: boolean; autoFocus?: boolean; action?: React.ReactNode }) {
  const [draft, setDraft] = useDraftValue(value, onCommit)
  return (
    <Field label={label} hint={hint} action={action}>
      {multiline
        ? <textarea rows={4} value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className={`${inputCls} resize-none leading-6`} />
        : <input value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className={inputCls} />}
    </Field>
  )
}

export function WordsCard({ ctl, open, onToggle, flash }: { ctl: EditorCtl; open: boolean; onToggle: () => void; flash: boolean }) {
  const headline = find(ctl.blocks, 'headline')
  const address = find(ctl.blocks, 'address')
  const description = find(ctl.blocks, 'description')
  const highlights = find(ctl.blocks, 'highlights')
  const cta = find(ctl.blocks, 'cta')
  const p = ctl.property
  // The agent's own wording for this home's lines carries to its next designs (saved per listing).
  const keepBlurb = (text: string) => {
    if (!p || !text.trim()) return
    api.studio.saveListingBlurb({ listing_key: p.listing_key, address: p.address, city: p.city, text }).catch(() => {})
  }
  const canDescribe = supportsDescription(ctl.fam, ctl.design.design_type, ctl.composition)
  const ideas = HEADLINE_IDEAS[ctl.situation || ''] || []
  const focus = ctl.focusBlockId
  const hintText = ctl.leadGen ? (headline?.data?.text || 'Headline and supporting line') : [headline?.data?.text, address?.overrides?.address || p?.address].filter(Boolean).join(' · ') || 'Headline and address'

  return (
    <Card icon={Type} title="Words" hint={hintText} open={open} onToggle={onToggle} flash={flash}>
      {headline && ctl.leadGen && (
        <>
          <TextField label="Headline" value={headline.data?.text || ''} onCommit={v => setData(ctl, headline.id, { text: v })} placeholder="What is your home worth?" autoFocus={focus === headline.id} />
          <TextField label="Supporting line" multiline value={headline.data?.subtext || ''} onCommit={v => setData(ctl, headline.id, { subtext: v })} placeholder="A sentence that makes the offer clear." />
          <ComplianceChips text={headline.data?.subtext || ''} onApply={text => setData(ctl, headline.id, { subtext: text })} />
          <TextField label="Small label above" value={headline.data?.eyebrow || ''} onCommit={v => setData(ctl, headline.id, { eyebrow: v })} placeholder="For Homeowners" />
        </>
      )}
      {headline && !ctl.leadGen && (
        <div>
          <TextField label="Headline" value={headline.data?.text || ''} onCommit={v => setData(ctl, headline.id, { text: v })} placeholder={SITUATION_HEADLINES[ctl.situation || ''] || 'Just Listed'} autoFocus={focus === headline.id} />
          {ideas.length > 0 && <Chips options={ideas} value={headline.data?.text || ''} onPick={v => setData(ctl, headline.id, { text: v })} />}
        </div>
      )}

      {address && (
        <div className="space-y-3">
          <TextField
            label="Street address" value={address.overrides?.address ?? p?.address ?? ''} onCommit={v => setOverride(ctl, address.id, 'address', v === (p?.address || '') ? '' : v)}
            placeholder="412 Ridgemont Drive" autoFocus={focus === address.id}
            action={address.overrides?.address !== undefined ? <button type="button" onClick={() => setOverride(ctl, address.id, 'address', '')} className="text-[10px] font-black text-[#8b7355] hover:underline">Use the listing&apos;s</button> : undefined}
          />
          <TextField
            label="Town line" value={address.overrides?.cityState ?? [p?.city, [p?.state, p?.zipcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')} onCommit={v => setOverride(ctl, address.id, 'cityState', v)}
            placeholder="Bryn Mawr, PA 19010"
            action={address.overrides?.cityState !== undefined ? <button type="button" onClick={() => setOverride(ctl, address.id, 'cityState', '')} className="text-[10px] font-black text-[#8b7355] hover:underline">Use the listing&apos;s</button> : undefined}
          />
          <div>
            <p className={labelCls}>Address on the design</p>
            <p className="mt-0.5 text-[11px] font-semibold text-gray-400">For sellers who want privacy.</p>
            <div className="mt-1.5">
              <Seg
                value={address.data?.hideStreet ? 'town' : address.data?.hideNumber ? 'number' : 'full'}
                options={[
                  { value: 'full', label: 'Full address' },
                  { value: 'number', label: 'No house #' },
                  { value: 'town', label: 'Town only' },
                ]}
                onChange={v => setData(ctl, address.id, { hideStreet: v === 'town', hideNumber: v === 'number' })}
              />
            </div>
          </div>
        </div>
      )}

      {(description || canDescribe) && (
        description ? (
          <div>
            <TextField
              label="Description" multiline value={description.data?.text || ''} onCommit={v => { setData(ctl, description.id, { text: v }); keepBlurb(v) }} placeholder="A few sentences about this home..." autoFocus={focus === description.id}
              action={<AiWriteButton purpose="listing_description" tones={['professional', 'warm', 'luxury', 'concise']} getContext={() => {
                const facts = [p?.address, p?.city && `${p.city}${p.state ? ', ' + p.state : ''}`, p?.price && money(p.price), p?.beds && `${p.beds} bed`, p?.baths && `${p.baths} bath`, p?.sqft && `${Number(p.sqft).toLocaleString()} sqft`].filter(Boolean).join(' · ')
                return [facts && `Property: ${facts}`, description.data?.text && `Current draft:\n${description.data.text}`].filter(Boolean).join('\n\n')
              }} onResult={text => { setData(ctl, description.id, { text }); keepBlurb(text) }} />}
            />
            {p?.description && description.data?.text !== p.description && <ResetLink onClick={() => setData(ctl, description.id, { text: p.description })}>Use the listing&apos;s description</ResetLink>}
            <ComplianceChips text={description.data?.text || ''} onApply={text => setData(ctl, description.id, { text })} />
            <button type="button" onClick={() => ctl.removeBlock(description.id)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-gray-400 hover:text-red-600"><X className="h-3 w-3" /> Remove the description</button>
          </div>
        ) : (
          <button type="button" onClick={() => ctl.addBlock({ id: blockId('description'), type: 'description', hidden: false, data: { text: p?.description || '' }, overrides: {} })} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3.5 py-2 text-xs font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15">
            <Plus className="h-3.5 w-3.5" /> Add a description
          </button>
        )
      )}

      {highlights && (
        <div>
          <p className={labelCls}>Highlights</p>
          <HighlightsList items={highlights.data?.items || []} onChange={items => setData(ctl, highlights.id, { items })} />
        </div>
      )}
      {!highlights && ctl.fam === 'portrait' && ctl.format.isPrint && !ctl.leadGen && (
        <button type="button" onClick={() => ctl.addBlock({ id: blockId('highlights'), type: 'highlights', hidden: false, data: { items: [''] }, overrides: {} })} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3.5 py-2 text-xs font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15">
          <Plus className="h-3.5 w-3.5" /> Add a few highlights
        </button>
      )}

      {headline && !ctl.format.isPrint && (
        <div>
          <p className={labelCls}>Instagram button</p>
          <p className="mt-0.5 text-[11px] font-semibold text-gray-400">What the button on the post says - the same wording as Instagram&apos;s ad buttons.</p>
          <Chips options={['Learn More', 'Contact Us', 'Send Message', 'Call Now', 'Get Quote', 'Sign Up', 'Book Now', 'Request Time', 'Get Directions', 'No button']} value={!headline.data?.socialButton || headline.data?.socialButton === 'none' ? 'No button' : headline.data?.socialButton} onPick={v => setData(ctl, headline.id, { socialButton: v === 'No button' ? 'none' : v })} />
        </div>
      )}
      {cta && (
        <div>
          <TextField label="Button text" value={cta.data?.label || ''} onCommit={v => setData(ctl, cta.id, { label: v })} placeholder="Learn more" autoFocus={focus === cta.id} />
          <Chips options={['Learn more', 'Get started', 'Request your valuation', "Let's talk", 'Schedule a showing', 'Start your search here']} value={cta.data?.label || ''} onPick={v => setData(ctl, cta.id, { label: v })} />
        </div>
      )}
      {!cta && ctl.leadGen && (
        <button type="button" onClick={() => ctl.addBlock({ id: blockId('cta'), type: 'cta', hidden: false, data: { label: 'Learn more' }, overrides: {} })} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3.5 py-2 text-xs font-black text-gray-500 transition hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15">
          <Plus className="h-3.5 w-3.5" /> Add a button
        </button>
      )}
    </Card>
  )
}

function HighlightsList({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div className="mt-2 space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={item} onChange={e => { const next = [...items]; next[i] = e.target.value; onChange(next) }} placeholder="Chef's kitchen" className={`${inputCls} mt-0`} />
          <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      ))}
      {items.length < 5 && (
        <button type="button" onClick={() => onChange([...items, ''])} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 px-3 py-2 text-xs font-black text-gray-500 hover:border-[#C9A24D] hover:text-[#8b7355] dark:border-white/15"><Plus className="h-3.5 w-3.5" /> Add a highlight</button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------------------------
// Price & details - price, the facts strip, open house date & time.
// ---------------------------------------------------------------------------------------------
function timeOfDay(value: string): string {
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h)) return value
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`
}
function longDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function DetailsCard({ ctl, open, onToggle, flash }: { ctl: EditorCtl; open: boolean; onToggle: () => void; flash: boolean }) {
  const price = find(ctl.blocks, 'price')
  const facts = find(ctl.blocks, 'facts')
  const oh = find(ctl.blocks, 'open_house_details')
  const p = ctl.property
  const sold = ctl.situation === 'just_sold'
  const listingValue = sold && p?.close_price ? p.close_price : p?.price
  const typed = price ? (price.overrides?.price !== undefined && price.overrides?.price !== '') || price.data?.priceSource === 'manual' : false
  const priceMode: 'listing' | 'typed' | 'hidden' = !price || price.hidden ? 'hidden' : typed ? 'typed' : 'listing'
  const [typedDraft, setTypedDraft] = useDraftValue(price?.overrides?.price !== undefined ? String(price.overrides.price) : '', v => price && setOverride(ctl, price.id, 'price', v ? Number(v) : ''))
  const priceLabelDefault = sold ? (p?.close_price || typed ? 'Sold for' : 'Listed at') : ctl.situation === 'price_improvement' ? 'New Price' : ctl.situation === 'coming_soon' ? 'Anticipated at' : 'Offered at'
  const labelChoices = Array.from(new Set([priceLabelDefault, 'Offered at', 'Asking', 'New Price', 'Listed at', 'Sold for']))
  const previousShown = !!price && (ctl.situation === 'price_improvement' || price.overrides?.previousPrice !== undefined)
  const [prevDraft, setPrevDraft] = useDraftValue(price?.overrides?.previousPrice !== undefined ? String(price.overrides.previousPrice) : (p?.original_price ? String(p.original_price) : ''), v => price && setOverride(ctl, price.id, 'previousPrice', v ? Number(v) : ''))
  const activeFields: string[] = facts?.data?.fields?.length ? facts.data.fields : [...DEFAULT_FACT_FIELDS]
  const focus = ctl.focusBlockId
  const hint = [price && !price.hidden ? money(price.overrides?.price ?? listingValue) : null, oh?.data?.date].filter(Boolean).join(' · ') || 'Price, facts, open house'

  const setOpenHouse = (patch: { dateIso?: string; startTime?: string; endTime?: string; eventId?: string | null }) => {
    if (!oh) return
    const dateIso = patch.dateIso ?? oh.data?.dateIso ?? ''
    const startTime = patch.startTime ?? oh.data?.startTime ?? ''
    const endTime = patch.endTime ?? oh.data?.endTime ?? ''
    setData(ctl, oh.id, {
      dateIso, startTime, endTime,
      open_house_event_id: patch.eventId === undefined ? (patch.dateIso || patch.startTime || patch.endTime ? null : oh.data?.open_house_event_id) : patch.eventId,
      date: dateIso ? longDate(dateIso) : oh.data?.date || '',
      time: startTime && endTime ? `${timeOfDay(startTime)} – ${timeOfDay(endTime)}` : startTime ? timeOfDay(startTime) : (dateIso ? '' : oh.data?.time || ''),
    })
  }
  const applyScheduled = (ev: OpenHouse) => {
    if (!oh) return
    setData(ctl, oh.id, {
      open_house_event_id: ev.openHouseEventId,
      dateIso: ev.scheduledDate || '', startTime: ev.scheduledStartTime ? ev.scheduledStartTime.slice(0, 5) : '', endTime: ev.scheduledEndTime ? ev.scheduledEndTime.slice(0, 5) : '',
      date: ev.scheduledDate ? longDate(ev.scheduledDate) : '',
      time: ev.scheduledStartTime && ev.scheduledEndTime ? `${timeOfDay(ev.scheduledStartTime.slice(0, 5))} – ${timeOfDay(ev.scheduledEndTime.slice(0, 5))}` : '',
    })
  }

  return (
    <Card icon={Calendar} title={oh ? 'Price, facts & open house' : 'Price & facts'} hint={hint} open={open} onToggle={onToggle} flash={flash}>
      {price && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className={labelCls}>{sold ? 'Sale price' : ctl.situation === 'price_improvement' ? 'New price' : 'Price'}</p>
              <button type="button" data-testid="price-visibility"
                onClick={() => { if (priceMode === 'hidden') setHidden(ctl, price.id, false); else setHidden(ctl, price.id, true) }}
                className="text-[10px] font-black text-gray-400 hover:text-[#8b7355] dark:hover:text-[#d7b974]">
                {priceMode === 'hidden' ? '+ Show a price' : 'Leave the price off'}
              </button>
            </div>
            {priceMode === 'hidden' ? (
              <p className="mt-1.5 rounded-xl border border-dashed border-gray-200 px-3.5 py-2.5 text-[12px] font-semibold text-gray-400 dark:border-white/10">No price on this design.</p>
            ) : (
              <>
                {/* Always a box you can type in - it starts at the listing's price (the sale price on
                    Just Sold); typing makes it your own price, on any situation. */}
                <div className={`mt-1.5 flex items-center gap-1 rounded-xl border bg-white px-3.5 py-2.5 font-serif text-xl font-black text-[#111827] focus-within:border-[#C9A24D] focus-within:ring-4 focus-within:ring-[#C9A24D]/15 dark:bg-[#18181b] dark:text-white ${typed ? 'border-[#C9A24D]/60' : 'border-gray-200 dark:border-white/10'}`}>
                  <span>$</span>
                  <input
                    data-testid="price-input"
                    value={prettyDigits(typed ? typedDraft : (listingValue ? String(Math.round(Number(listingValue))) : ''))}
                    onChange={e => {
                      if (!typed) ctl.updateBlock(price.id, b => ({ ...b, hidden: false, data: { ...b.data, priceSource: 'manual' } }))
                      setTypedDraft(digitsOnly(e.target.value))
                    }}
                    onFocus={e => e.currentTarget.select()}
                    inputMode="numeric"
                    autoFocus={focus === price.id}
                    placeholder="1,250,000"
                    className="w-full min-w-0 bg-transparent outline-none placeholder:text-gray-300"
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10.5px] font-semibold text-gray-400">
                  <span>{typed ? (sold ? 'Your price · shows "Sold for"' : 'Your price') : p ? (sold ? (p.close_price ? 'The recorded sale price - type to change it' : 'Last list price - type the sale price') : 'From the listing - type to change it') : 'Type the price'}</span>
                  {typed && p && money(listingValue) && (
                    <button type="button" onClick={() => ctl.updateBlock(price.id, b => { const o = { ...b.overrides }; delete o.price; return { ...b, hidden: false, overrides: o, data: { ...b.data, priceSource: undefined } } })}
                      className="shrink-0 font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">Use {money(listingValue)}</button>
                  )}
                </div>
              </>
            )}
          </div>
          {priceMode !== 'hidden' && (
            <>
              <div>
                <p className={labelCls}>Small label above the price</p>
                <Chips options={labelChoices} value={price.data?.label ?? priceLabelDefault} onPick={v => setData(ctl, price.id, { label: v === priceLabelDefault ? undefined : v })} />
              </div>
              {previousShown ? (
                <Field label="Previous price (shown crossed out)" action={<button type="button" onClick={() => setOverride(ctl, price.id, 'previousPrice', '')} className="text-[10px] font-black text-gray-400 hover:text-red-600">Remove</button>}>
                  <div className="mt-1.5 flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[15px] font-black text-[#111827] focus-within:border-[#C9A24D] dark:border-white/10 dark:bg-[#18181b] dark:text-white">
                    <span>$</span><input value={prettyDigits(prevDraft)} onChange={e => setPrevDraft(digitsOnly(e.target.value))} inputMode="numeric" placeholder={p?.original_price ? Number(p.original_price).toLocaleString('en-US') : 'Was'} className="w-full min-w-0 bg-transparent outline-none placeholder:text-gray-300" />
                  </div>
                </Field>
              ) : (
                <button type="button" onClick={() => setOverride(ctl, price.id, 'previousPrice', p?.original_price || ' ')} className="text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">+ Show a previous price, crossed out</button>
              )}
            </>
          )}
        </div>
      )}

      {facts && (
        <div>
          <div className="flex items-center justify-between">
            <p className={labelCls}>Facts strip</p>
            <button type="button" onClick={() => setHidden(ctl, facts.id, !facts.hidden)} className="text-[11px] font-black text-[#8b7355] hover:underline dark:text-[#d7b974]">{facts.hidden ? 'Show the facts' : 'Hide the facts'}</button>
          </div>
          {!facts.hidden && (
            <>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ADDABLE_FACT_FIELDS.map(f => {
                  const on = activeFields.includes(f.key)
                  return <button key={f.key} type="button" onClick={() => setData(ctl, facts.id, { fields: on ? activeFields.filter(k => k !== f.key) : [...activeFields, f.key] })} className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>{f.label}</button>
                })}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {activeFields.map(key => (
                  <FactInput key={key} label={ADDABLE_FACT_FIELDS.find(f => f.key === key)?.label || key} value={facts.overrides?.[key] ?? (p as any)?.[key] ?? ''} overridden={facts.overrides?.[key] !== undefined} onCommit={v => setOverride(ctl, facts.id, key, v === String((p as any)?.[key] ?? '') ? '' : v)} onReset={() => setOverride(ctl, facts.id, key, '')} autoFocus={focus === facts.id && key === activeFields[0]} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {oh && (
        <div>
          <p className={labelCls}>Open house</p>
          {ctl.linkedOpenHouses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ctl.linkedOpenHouses.map(ev => {
                const on = oh.data?.open_house_event_id === ev.openHouseEventId
                return (
                  <button key={ev.id} type="button" onClick={() => applyScheduled(ev)} className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${on ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355]' : 'border-gray-200 text-gray-500 hover:border-[#C9A24D]/60 dark:border-white/10 dark:text-gray-300'}`}>
                    {ev.scheduledDate ? longDate(ev.scheduledDate) : 'Unscheduled'}{ev.scheduledStartTime && ev.scheduledEndTime ? ` · ${timeOfDay(ev.scheduledStartTime.slice(0, 5))}–${timeOfDay(ev.scheduledEndTime.slice(0, 5))}` : ''}
                  </button>
                )
              })}
            </div>
          )}
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="Date"><input type="date" value={oh.data?.dateIso || ''} onChange={e => setOpenHouse({ dateIso: e.target.value, eventId: null })} className={inputCls} autoFocus={focus === oh.id} /></Field>
            <Field label="Starts"><input type="time" value={oh.data?.startTime || ''} onChange={e => setOpenHouse({ startTime: e.target.value, eventId: null })} className={inputCls} /></Field>
            <Field label="Ends"><input type="time" value={oh.data?.endTime || ''} onChange={e => setOpenHouse({ endTime: e.target.value, eventId: null })} className={inputCls} /></Field>
          </div>
          {!oh.data?.dateIso && oh.data?.date && <p className="mt-1.5 text-[11px] font-semibold text-gray-400">Currently shows: {oh.data.date}{oh.data.time ? ` · ${oh.data.time}` : ''}</p>}
          {ctl.linkedOpenHouses.length === 0 && <p className="mt-1.5 text-[11px] font-semibold text-gray-400">No open house is scheduled for this listing yet - type the date here, or schedule one in Open House Manager and it will show up above.</p>}
        </div>
      )}
      {!price && !facts && !oh && <Note>This design has no price or facts to edit.</Note>}
    </Card>
  )
}

function FactInput({ label, value, overridden, onCommit, onReset, autoFocus }: { label: string; value: string | number; overridden: boolean; onCommit: (v: string) => void; onReset: () => void; autoFocus?: boolean }) {
  const [draft, setDraft] = useDraftValue(String(value ?? ''), onCommit)
  return (
    <label className="block">
      <span className="flex items-center justify-between"><span className={labelCls}>{label}</span>{overridden && <button type="button" onClick={onReset} className="text-[10px] font-black text-[#8b7355] hover:underline">Listing&apos;s</button>}</span>
      <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus={autoFocus} className={inputCls} />
    </label>
  )
}

// Exported for the editor's "add" affordances / canvas mapping.
export const BLOCK_TO_CARD: Record<DesignBlock['type'], CardId> = {
  hero_photo: 'photo', photo_gallery: 'photo',
  headline: 'words', address: 'words', description: 'words', highlights: 'words', cta: 'words',
  price: 'details', facts: 'details', open_house_details: 'details',
  agent_info: 'you', brokerage_branding: 'you',
  qr_code: 'leads',
}

export { Sparkles, Maximize2 }
