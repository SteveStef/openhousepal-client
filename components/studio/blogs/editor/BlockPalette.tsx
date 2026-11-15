'use client'

// "Add a section" - every section style an article can have, each drawn the way it will look in
// this article (same components readers get, in the article's color), ready to drag onto the page
// or tap to drop in. On a computer it is a panel down the left side that stays open while you
// build; on a phone it is a sheet that slides up.

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { Clapperboard, Home, Images, ImageIcon, MapPin, Play, Tag, X } from 'lucide-react'
import type { BlogBlock } from '@/types'
import BlogArticleBody, { type BlogArticleAgentInfo } from '@/components/studio/blogs/BlogArticleBody'
import { PopupSheet } from '@/components/ui/AnchoredPopup'
import { newBlock, SINGLE_TYPES, type BlockType } from './blockOps'

export type PaletteItem = {
  key: string
  label: string
  hint: string
  group: string
  /** The blocks dropped into the article (fresh ids every time). */
  make: () => BlogBlock[]
  /** What the tile draws: real blocks at a small size... */
  sample?: BlogBlock[]
  /** ...or a small drawing, for sections that need the agent's own photo / town / homes first. */
  art?: 'photo' | 'gallery' | 'video' | 'home' | 'town' | 'homes' | 'videos'
  /** One per article. */
  single?: BlockType
}

const s = (type: BlockType, data: Record<string, any>): BlogBlock => ({ id: `sample-${type}-${Math.random().toString(36).slice(2, 7)}`, type, data })

export const PALETTE: PaletteItem[] = [
  { key: 'section', group: 'Writing', label: 'New section', hint: 'A heading with a paragraph under it', make: () => [newBlock('heading'), newBlock('paragraph')],
    sample: [s('heading', { html: 'What to do first' }), s('paragraph', { html: 'Start with the one thing buyers notice the moment they pull up to the house.' })] },
  { key: 'heading', group: 'Writing', label: 'Heading', hint: 'Starts a new section', make: () => [newBlock('heading')], sample: [s('heading', { html: 'A section heading' }), s('paragraph', { html: 'The section starts here.' })] },
  { key: 'subheading', group: 'Writing', label: 'Subheading', hint: 'A smaller title inside a section', make: () => [newBlock('subheading')], sample: [s('subheading', { html: 'A smaller subheading' }), s('paragraph', { html: 'With the words that follow it.' })] },
  { key: 'paragraph', group: 'Writing', label: 'Paragraph', hint: 'Plain writing', make: () => [newBlock('paragraph')], sample: [s('paragraph', { html: 'Homes here tend to sell fastest in early spring, when buyers who waited out the winter all start looking at once.' })] },
  { key: 'bulleted_list', group: 'Writing', label: 'Bullet points', hint: 'Enter adds the next point', make: () => [newBlock('bulleted_list')], sample: [s('bulleted_list', { items: ['Fresh paint in a light, warm color', 'Bright bulbs in every room', 'A clear, tidy front step'] })] },
  { key: 'numbered_list', group: 'Writing', label: 'Numbered steps', hint: 'Steps in order', make: () => [newBlock('numbered_list')], sample: [s('numbered_list', { items: ['Get pre-approved', 'Tour homes in person', 'Make your offer'] })] },
  { key: 'glance', group: 'Writing', label: 'At a glance box', hint: 'A bold title with quick points', make: () => [newBlock('callout', { html: '<strong>At a glance</strong><br>• ' })],
    sample: [s('callout', { html: '<strong>At a glance</strong><br>• Best months to list: March to May<br>• Typical time to sell: about 3 weeks' })] },
  { key: 'callout', group: 'Writing', label: 'Tip or fun fact box', hint: 'One thing that should stand out', make: () => [newBlock('callout')], sample: [s('callout', { html: 'Fun fact: the oldest house on this street was built before the railroad arrived.' })] },
  { key: 'quote', group: 'Writing', label: 'Pull quote', hint: 'A line in big italic type', make: () => [newBlock('quote')], sample: [s('quote', { html: 'The best time to prepare is before the sign goes up.' })] },
  { key: 'divider', group: 'Writing', label: 'Divider', hint: 'A small ornament between sections', make: () => [newBlock('divider')], sample: [s('divider', {})] },

  { key: 'image', group: 'Photos and video', label: 'Photo', hint: 'One photo with a caption', make: () => [newBlock('image')], art: 'photo' },
  { key: 'gallery', group: 'Photos and video', label: 'Photo gallery', hint: 'A grid of photos', make: () => [newBlock('gallery')], art: 'gallery' },
  { key: 'youtube', group: 'Photos and video', label: 'YouTube video', hint: 'Plays right in the article', make: () => [newBlock('youtube')], art: 'video' },

  { key: 'area_spotlight', group: 'From your business', label: 'Town spotlight', hint: 'Live market numbers, schools, what is nearby', make: () => [newBlock('area_spotlight')], art: 'town' },
  { key: 'sales', group: 'From your business', label: 'Your recent sales', hint: 'A row of homes you sold', make: () => [newBlock('property_showcase', { kind: 'sales', title: 'Recent Sales in the Area', properties: [] })], art: 'homes' },
  { key: 'listings', group: 'From your business', label: 'Your listings', hint: 'A row of your homes for sale', make: () => [newBlock('property_showcase', { kind: 'listings', title: 'Homes for Sale', properties: [] })], art: 'homes' },
  { key: 'property_card', group: 'From your business', label: 'One home', hint: 'A single listing card', make: () => [newBlock('property_card')], art: 'home' },
  { key: 'video_showcase', group: 'From your business', label: 'Your videos', hint: 'Videos from your Agent Hub', make: () => [newBlock('video_showcase', { title: 'Videos about the area', videos: [] })], art: 'videos' },

  { key: 'ask_agent', group: 'Get in touch', label: 'Ask me line', hint: 'Call, Text, Email right under a sentence', make: () => [newBlock('ask_agent')], sample: [s('ask_agent', { topic: 'first-time buyer programs' })] },
  { key: 'button', group: 'Get in touch', label: 'Button', hint: 'Opens any link', make: () => [newBlock('button', { label: 'Learn More' })], sample: [s('button', { label: 'Learn More', url: '#' })] },
  { key: 'lead_form', group: 'Get in touch', label: 'One of your forms', hint: 'Home value, buying, selling...', make: () => [newBlock('lead_form')], sample: [s('lead_form', { formSlug: 'sample', title: "What's my home worth?", description: 'A quick, no-pressure estimate.', label: 'Start' })] },
  { key: 'contact_form', group: 'Get in touch', label: 'Contact form', hint: 'Questions arrive in your Leads', make: () => [newBlock('contact_form')], sample: [s('contact_form', { label: 'Ask me a question' })] },
  { key: 'cta', group: 'Get in touch', label: 'Closing section', hint: 'The big finish with your photo and a button', make: () => [newBlock('cta', { action: 'contact' })], sample: [s('cta', {})], single: 'cta' },
  { key: 'agent_profile', group: 'Get in touch', label: 'Contact card', hint: 'Your photo, name and a Contact button', make: () => [newBlock('agent_profile')], sample: [s('agent_profile', {})], single: 'agent_profile' },
  { key: 'qr_code', group: 'Get in touch', label: 'QR code', hint: 'For printed copies', make: () => [newBlock('qr_code')], sample: [s('qr_code', { url: 'https://openhousepal.com', label: 'Scan for more' })] },
  { key: 'related_articles', group: 'Get in touch', label: 'Keep reading', hint: 'Your other articles', make: () => [newBlock('related_articles')], sample: [s('related_articles', {})], single: 'related_articles' },
  { key: 'disclaimer', group: 'Get in touch', label: 'Small print', hint: 'A disclaimer line', make: () => [newBlock('disclaimer')], sample: [s('disclaimer', { text: 'Information deemed reliable but not guaranteed. Not legal or financial advice.' })] },
]

const GROUPS = ['Writing', 'Photos and video', 'From your business', 'Get in touch']

function Art({ kind, accent }: { kind: NonNullable<PaletteItem['art']>; accent: string }) {
  const photo = { background: `linear-gradient(135deg, ${accent}55, #1f2937 85%)` }
  const line = 'h-1.5 rounded-full bg-gray-300 dark:bg-white/20'
  if (kind === 'photo') return <div className="flex h-full flex-col gap-1.5"><div className="grid flex-1 place-items-center rounded-lg text-white/80" style={photo}><ImageIcon className="h-5 w-5" /></div><div className={`${line} mx-auto w-1/2`} /></div>
  if (kind === 'gallery') return <div className="grid h-full grid-cols-3 gap-1.5">{[0, 1, 2].map(k => <div key={k} className="grid place-items-center rounded-lg text-white/70" style={photo}>{k === 1 && <Images className="h-4 w-4" />}</div>)}</div>
  if (kind === 'video') return <div className="grid h-full place-items-center rounded-lg bg-[#111827]"><span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#111827]"><Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" /></span></div>
  if (kind === 'videos') return <div className="grid h-full grid-cols-2 gap-1.5">{[0, 1].map(k => <div key={k} className="grid place-items-center rounded-lg bg-[#111827] text-white/80"><Clapperboard className="h-4 w-4" /></div>)}</div>
  if (kind === 'town') return <div className="relative h-full overflow-hidden rounded-lg" style={photo}><MapPin className="absolute right-2 top-2 h-4 w-4 text-white/80" /><div className="absolute bottom-2 left-2 font-serif text-sm font-black text-white">Your town</div></div>
  if (kind === 'home') return <div className="flex h-full items-center gap-2 rounded-lg border border-gray-200 bg-white p-1.5 dark:border-white/10 dark:bg-white/5"><div className="grid h-full w-14 place-items-center rounded-md text-white/80" style={photo}><Home className="h-4 w-4" /></div><div className="flex-1 space-y-1.5"><div className={`${line} w-4/5`} /><div className={`${line} w-1/2`} /></div></div>
  return <div className="grid h-full grid-cols-3 gap-1.5">{[0, 1, 2].map(k => <div key={k} className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5"><div className="grid flex-1 place-items-center text-white/80" style={photo}>{k === 0 && <Tag className="h-3.5 w-3.5" />}</div><div className="space-y-1 p-1"><div className={`${line} w-full`} /><div className={`${line} w-2/3`} /></div></div>)}</div>
}

const SCALE = 0.46

function Tile({ item, accent, agent, disabled, onPick, onDragStart }: {
  item: PaletteItem; accent: string; agent: BlogArticleAgentInfo; disabled: boolean
  onPick: (item: PaletteItem) => void
  onDragStart?: (item: PaletteItem, e: PointerEvent) => void
}) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const dragged = useRef(false)
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={`Add ${item.label}`}
      data-palette-tile={item.key}
      onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onPick(item) } }}
      title={disabled ? 'Already in this article' : `${item.label} - ${item.hint}`}
      onPointerDown={e => {
        if (disabled || !onDragStart || e.pointerType === 'touch' || e.button !== 0) return
        start.current = { x: e.clientX, y: e.clientY }
        dragged.current = false
        const move = (ev: PointerEvent) => {
          if (!start.current || dragged.current) return
          if (Math.hypot(ev.clientX - start.current.x, ev.clientY - start.current.y) > 6) { dragged.current = true; stop(); onDragStart(item, ev) }
        }
        const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); start.current = null }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', stop)
      }}
      onClick={() => { if (disabled) return; if (dragged.current) { dragged.current = false; return } onPick(item) }}
      className={`group flex w-full touch-manipulation flex-col overflow-hidden rounded-2xl border bg-white text-left transition dark:bg-[#151517] ${disabled ? 'cursor-not-allowed border-gray-200 opacity-45 dark:border-white/10' : 'cursor-grab border-gray-200 hover:-translate-y-0.5 hover:border-[#C9A24D] hover:shadow-[0_14px_30px_-22px_rgba(201,162,77,.9)] active:cursor-grabbing dark:border-white/10'}`}
    >
      <span className="pointer-events-none relative block h-[84px] w-full select-none overflow-hidden bg-[#fbfaf7] p-2.5 dark:bg-[#0f0f11]" aria-hidden>
        {item.art ? <Art kind={item.art} accent={accent} /> : (
          <span className="block origin-top-left" style={{ width: `${100 / SCALE}%`, transform: `scale(${SCALE})` }}>
            <BlogArticleBody blocks={item.sample || []} agent={agent} accentColor={accent} />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-[#fbfaf7] to-transparent dark:from-[#0f0f11]" />
      </span>
      <span className="block border-t border-gray-100 px-2.5 py-2 dark:border-white/10">
        <span className="block truncate text-[12px] font-black text-[#111827] dark:text-white">{item.label}</span>
        <span className="block truncate text-[10px] font-semibold text-gray-500 dark:text-gray-400">{disabled ? 'Already in this article' : item.hint}</span>
      </span>
    </div>
  )
}

export default function BlockPalette({ open, phone, top, blocks, accent, agent, where, onPick, onDragStart, onClose }: {
  open: boolean
  phone: boolean
  /** Where the side panel starts (under the editor's top bar), in pixels. */
  top: number
  blocks: BlogBlock[]
  accent: string
  agent: BlogArticleAgentInfo
  /** One line saying where a tapped section lands ("Goes under “Pricing it right”"). */
  where: string
  onPick: (item: PaletteItem) => void
  onDragStart: (item: PaletteItem, e: PointerEvent) => void
  onClose: () => void
}) {
  const taken = (item: PaletteItem) => !!item.single && SINGLE_TYPES.includes(item.single) && blocks.some(b => b.type === item.single)
  const list = (
    <div className="space-y-4">
      {GROUPS.map(group => (
        <div key={group}>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#8b7355] dark:text-[#e8c97a]">{group}</p>
          <div className="grid grid-cols-2 gap-2">
            {PALETTE.filter(i => i.group === group).map(item => (
              <Tile key={item.key} item={item} accent={accent} agent={agent} disabled={taken(item)} onPick={onPick} onDragStart={phone ? undefined : onDragStart} />
            ))}
          </div>
        </div>
      ))}
      <p className="rounded-xl bg-gray-100 p-3 text-[11px] font-semibold leading-relaxed text-gray-500 dark:bg-white/5 dark:text-gray-400">
        The payment example and the sources list come from the AI writer&apos;s research, so they can&apos;t be added by hand. If your article has them, you can move or remove them.
      </p>
    </div>
  )
  if (phone) {
    return (
      <PopupSheet open={open} onClose={onClose} title="Add a section">
        <p className="mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400">Tap one to add it. {where}</p>
        {list}
      </PopupSheet>
    )
  }
  if (!open) return null
  return (
    <motion.aside
      data-blog-editor-ui
      initial={{ x: -340, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="fixed bottom-0 left-0 z-[28] flex w-[340px] flex-col border-r border-gray-200 bg-white/95 shadow-[20px_0_50px_-30px_rgba(0,0,0,.45)] dark:border-white/10 dark:bg-[#121214]/95"
      style={{ top }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
        <div className="min-w-0">
          <p className="font-serif text-lg font-black leading-tight text-[#111827] dark:text-white">Add a section</p>
          <p className="mt-0.5 text-[11px] font-semibold leading-snug text-gray-500 dark:text-gray-400">Drag one onto the page, or click it. {where}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">{list}</div>
    </motion.aside>
  )
}
