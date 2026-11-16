// The blog editor's rules, as plain functions over the article's `blocks` list (no React, no DOM).
// Every edit the agent makes on the page - Enter in a list, Backspace at the start of a paragraph,
// dragging a section, duplicating a callout - ends up as one of these, so the saved JSON keeps the
// same shapes the AI writer produces and the published article renders.

import type { BlogBlock } from '@/types'
import { escapeHtml, sanitizeInlineHtml } from '@/lib/studio/sanitizeHtml'

export type BlockType = BlogBlock['type']

/** Text you type straight onto the page, with bold / italic / links. */
export const RICH_TYPES: BlockType[] = ['paragraph', 'heading', 'subheading', 'quote', 'callout']
export const LIST_TYPES: BlockType[] = ['bulleted_list', 'numbered_list']
/** Boxes that hold several lines: Enter adds a line, Enter on an empty last line leaves the box. */
export const SOFT_TYPES: BlockType[] = ['quote', 'callout']
/** What the AI's "Refine" rewrites - everything else in a section is kept as it is. */
export const REFINABLE_TYPES: BlockType[] = [...RICH_TYPES, ...LIST_TYPES, 'ask_agent']
/** How an article ends (closing words -> sources -> your sales / listings / videos -> the closing
 *  button -> your contact card). A trailing run of these is "the ending", not part of a section. */
export const TAIL_TYPES: BlockType[] = ['sources', 'property_showcase', 'video_showcase', 'cta', 'agent_profile', 'related_articles', 'disclaimer']
export const CLOSING_TYPES: BlockType[] = ['cta', 'agent_profile']
/** One per article - the palette greys these out once the article has one, and they can't be duplicated. */
export const SINGLE_TYPES: BlockType[] = ['cta', 'agent_profile', 'related_articles', 'sources', 'payment_example']
/** Filled from real data (listings, rates, sources) - never typed by hand. */
export const DATA_TYPES: BlockType[] = ['payment_example', 'sources']

export const isRich = (t: BlockType) => RICH_TYPES.includes(t)
export const isList = (t: BlockType) => LIST_TYPES.includes(t)
export const isText = (t: BlockType) => isRich(t) || isList(t)

export const BLOCK_LABELS: Partial<Record<BlockType, string>> = {
  paragraph: 'Paragraph', heading: 'Heading', subheading: 'Subheading', quote: 'Quote', callout: 'Callout box',
  bulleted_list: 'Bullet points', numbered_list: 'Numbered steps', divider: 'Divider', image: 'Photo', gallery: 'Photo gallery',
  youtube: 'Video', property_card: 'Home', area_spotlight: 'Town spotlight', property_showcase: 'Homes row', video_showcase: 'Videos',
  payment_example: 'Payment example', sources: 'Sources', ask_agent: 'Ask me line', button: 'Button', cta: 'Closing section',
  contact_form: 'Contact form', lead_form: 'Lead form', qr_code: 'QR code', related_articles: 'Keep reading', disclaimer: 'Disclaimer',
  agent_profile: 'Contact card',
}
export const labelOf = (b: BlogBlock) => (b.type === 'property_showcase' ? (b.data?.kind === 'listings' ? 'Your listings' : 'Recent sales') : BLOCK_LABELS[b.type] || 'Section')

export function newId(type: string): string {
  return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function newBlock(type: BlockType, data: Record<string, any> = {}): BlogBlock {
  return { id: newId(type), type, data: isList(type) ? { items: [''], ...data } : { ...data } }
}

export const htmlOf = (b: BlogBlock): string => (b.data?.html ? String(b.data.html) : b.data?.text ? escapeHtml(String(b.data.text)) : '')
export const plainOfHtml = (html: string): string => html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&bull;/g, '•').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
export const plainOf = (b: BlogBlock): string => (isList(b.type) ? (b.data?.items || []).join('\n') : plainOfHtml(htmlOf(b)))
/** Typed text as it is stored for a list item or another plain line. */
export const cleanPlain = (text: string): string => text.replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, ' ')

const withData = (b: BlogBlock, data: Record<string, any>): BlogBlock => ({ ...b, data: { ...(b.data || {}), ...data } })
/** A rich block's words. `text` (older articles' plain copy) is cleared so emptied text stays empty. */
export const withHtml = (b: BlogBlock, html: string): BlogBlock => withData(b, { html, text: '' })
const itemsOf = (b: BlogBlock): string[] => (Array.isArray(b.data?.items) && b.data.items.length ? b.data.items.map((i: any) => String(i ?? '')) : [''])

// ---------------------------------------------------------------------------
// Sections and the ending
// ---------------------------------------------------------------------------

/** Where the article's ending starts (the trailing run of ending blocks). */
export function tailStart(blocks: BlogBlock[]): number {
  let i = blocks.length
  while (i > 0 && TAIL_TYPES.includes(blocks[i - 1].type)) i--
  return i
}

/** What moves, hides or duplicates together: a heading takes its whole section (up to the next
 *  heading or the article's ending); anything else is just itself. */
// ---- whose words are these? ------------------------------------------------------------------
// Every block the AI writer makes carries "-ai-" in its id (the server's _bid). A block the agent added does not,
// and an AI block whose words the agent changed is marked `data.edited`. "Refine with AI" goes by this (owner,
// 11/16): the AI's own fact-checked paragraphs are not offered for another AI rewrite; the agent's words are.
const AI_ID = /-ai-/
const wordsOf = (b: BlogBlock) => JSON.stringify([b.data?.html ?? null, b.data?.text ?? null, b.data?.items ?? null, b.data?.title ?? null])
export const byHand = (b: BlogBlock) => !AI_ID.test(b.id) || !!b.data?.edited
/** Did the AI writer write (any of) this article? */
export const aiWrote = (blocks: BlogBlock[]) => blocks.some(b => AI_ID.test(b.id))

/** After an edit: an AI-written block whose words changed is now the agent's own. Returns `next` itself when nothing changed. */
export function stampEdited(prev: BlogBlock[], next: BlogBlock[]): BlogBlock[] {
  const before = new Map(prev.map(b => [b.id, b]))
  let changed = false
  const out = next.map(b => {
    const o = before.get(b.id)
    if (!o || o === b || !AI_ID.test(b.id) || b.data?.edited || !REFINABLE_TYPES.includes(b.type) || wordsOf(o) === wordsOf(b)) return b
    changed = true
    return { ...b, data: { ...(b.data || {}), edited: true } }
  })
  return changed ? out : next
}

/** What Refine can fix: words (never a card, a photo or the "Ask me" line). */
export const POLISH_TYPES: BlockType[] = [...RICH_TYPES, ...LIST_TYPES]

/** The passages a press of Refine on this block sends to be fixed: the agent's own words, nothing the AI wrote.
 *  On a heading that is the section's passages; on anything else, that one passage. */
export function refineTargets(blocks: BlogBlock[], id: string): BlogBlock[] {
  const r = unitRange(blocks, id)
  if (!r) return []
  const ai = aiWrote(blocks)
  return blocks.slice(r[0], r[1]).filter(x => POLISH_TYPES.includes(x.type) && (!ai || byHand(x)) && !!plainOf(x).trim())
}

/** Is Refine offered on this block? One button per section (its heading) wherever the section holds words of the
 *  agent's own under it. A passage with no section button of its own to go to - one the agent typed or changed in an
 *  article the AI wrote, or anything above the first heading - carries the button itself. */
export function canRefine(blocks: BlogBlock[], id: string): boolean {
  const b = blocks.find(x => x.id === id)
  if (!b) return false
  if (b.type === 'heading') return refineTargets(blocks, id).some(x => x.type !== 'heading')
  if (!POLISH_TYPES.includes(b.type) || !plainOf(b).trim()) return false
  if (aiWrote(blocks)) return byHand(b)
  return sectionOwners(blocks)[id] == null && tailStart(blocks) > blocks.indexOf(b)
}

export function unitRange(blocks: BlogBlock[], id: string): [number, number] | null {
  const start = blocks.findIndex(b => b.id === id)
  if (start === -1) return null
  if (blocks[start].type !== 'heading') return [start, start + 1]
  const stop = Math.max(tailStart(blocks), start + 1)
  let end = start + 1
  while (end < stop && blocks[end].type !== 'heading') end++
  return [start, end]
}

/** The heading that owns each block (null before the first heading and in the ending). */
export function sectionOwners(blocks: BlogBlock[]): Record<string, string | null> {
  const owner: Record<string, string | null> = {}
  const tail = tailStart(blocks)
  let current: string | null = null
  blocks.forEach((b, i) => {
    if (b.type === 'heading') { current = b.id; owner[b.id] = null; return }
    owner[b.id] = i >= tail ? null : current
  })
  return owner
}

/** Body sections can't be dropped below the closing button / contact card - those always end the article. */
export function clampDrop(blocks: BlogBlock[], moving: BlogBlock[], index: number): number {
  const at = Math.max(0, Math.min(index, blocks.length))
  if (moving.every(b => TAIL_TYPES.includes(b.type))) return at
  const closing = blocks.findIndex((b, i) => i >= tailStart(blocks) && CLOSING_TYPES.includes(b.type))
  return closing === -1 ? at : Math.min(at, closing)
}

/** Where a new section goes when nothing is selected: the end of the body, above the ending. */
export const defaultInsertIndex = (blocks: BlogBlock[]) => tailStart(blocks)

export function insertAt(blocks: BlogBlock[], index: number, added: BlogBlock[]): BlogBlock[] {
  const at = clampDrop(blocks, added, index)
  return [...blocks.slice(0, at), ...added, ...blocks.slice(at)]
}

/** Moves a block (or a heading's whole section) so it starts at gap `index` of the current list. */
export function moveUnit(blocks: BlogBlock[], id: string, index: number): BlogBlock[] {
  const r = unitRange(blocks, id)
  if (!r) return blocks
  const unit = blocks.slice(r[0], r[1])
  const at = clampDrop(blocks, unit, index)
  if (at >= r[0] && at <= r[1]) return blocks
  const rest = [...blocks.slice(0, r[0]), ...blocks.slice(r[1])]
  const to = at > r[0] ? at - unit.length : at
  return [...rest.slice(0, to), ...unit, ...rest.slice(to)]
}

/** One step up or down. A section steps over the whole section next to it. */
export function stepUnit(blocks: BlogBlock[], id: string, dir: -1 | 1): BlogBlock[] {
  const r = unitRange(blocks, id)
  if (!r) return blocks
  const section = blocks[r[0]].type === 'heading'
  if (dir === -1) {
    if (r[0] === 0) return blocks
    let to = r[0] - 1
    if (section) {
      // a section trades places with the section above it (never above the article's opening words)
      while (to > 0 && blocks[to].type !== 'heading') to--
      if (blocks[to].type !== 'heading') return blocks
    }
    return moveUnit(blocks, id, to)
  }
  if (r[1] >= blocks.length) return blocks
  if (!section) return moveUnit(blocks, id, r[1] + 1)
  // ...and with the section below it (never into the article's ending)
  const next = blocks[r[1]].type === 'heading' ? unitRange(blocks, blocks[r[1]].id) : null
  return next ? moveUnit(blocks, id, next[1]) : blocks
}

export function canStep(blocks: BlogBlock[], id: string, dir: -1 | 1): boolean {
  return stepUnit(blocks, id, dir) !== blocks
}

/** A copy right after the original (a heading copies its section). Null when it can't be copied. */
export function duplicateUnit(blocks: BlogBlock[], id: string): { blocks: BlogBlock[]; firstId: string } | null {
  const r = unitRange(blocks, id)
  if (!r) return null
  const unit = blocks.slice(r[0], r[1])
  if (unit.some(b => SINGLE_TYPES.includes(b.type))) return null
  const copy = unit.map(b => ({ ...b, id: newId(b.type), data: JSON.parse(JSON.stringify(b.data || {})) }))
  return { blocks: [...blocks.slice(0, r[1]), ...copy, ...blocks.slice(r[1])], firstId: copy[0].id }
}

export const removeBlock = (blocks: BlogBlock[], id: string) => blocks.filter(b => b.id !== id)
export function removeUnit(blocks: BlogBlock[], id: string): BlogBlock[] {
  const r = unitRange(blocks, id)
  return r ? [...blocks.slice(0, r[0]), ...blocks.slice(r[1])] : blocks
}

// ---------------------------------------------------------------------------
// Typing: Enter / Backspace
// ---------------------------------------------------------------------------

/** Where the caret goes after an edit: a text spot ("<block id>:html", "<block id>:i2") and a place in it. */
export type Focus = { host: string; at: 'start' | 'end' | number } | { select: string }
export type Edit = { blocks: BlogBlock[]; focus?: Focus }

const hostOf = (b: BlogBlock, item = 0) => (isList(b.type) ? `${b.id}:i${item}` : `${b.id}:html`)
const paragraphLike = (from: BlogBlock, html: string) => newBlock('paragraph', { html, ...(from.type === 'paragraph' ? { size: from.data?.size, align: from.data?.align } : {}) })

/** Enter in a paragraph, heading or subheading: the text after the caret starts a new paragraph. */
export function splitRich(blocks: BlogBlock[], id: string, before: string, after: string): Edit {
  const i = blocks.findIndex(b => b.id === id)
  if (i === -1) return { blocks }
  const cur = blocks[i]
  // Enter at the very start of a heading that has words: room for a paragraph above it.
  if (!before && after && cur.type !== 'paragraph') {
    const fresh = newBlock('paragraph')
    return { blocks: [...blocks.slice(0, i), fresh, ...blocks.slice(i)], focus: { host: hostOf(cur), at: 'start' } }
  }
  const fresh = paragraphLike(cur, after)
  return { blocks: [...blocks.slice(0, i), withHtml(cur, before), fresh, ...blocks.slice(i + 1)], focus: { host: hostOf(fresh), at: 'start' } }
}

/** Leaving a quote or callout (Enter on its empty last line): a new paragraph under it. */
export function exitBox(blocks: BlogBlock[], id: string, html: string): Edit {
  const i = blocks.findIndex(b => b.id === id)
  if (i === -1) return { blocks }
  const fresh = newBlock('paragraph')
  return { blocks: [...blocks.slice(0, i), withHtml(blocks[i], html), fresh, ...blocks.slice(i + 1)], focus: { host: hostOf(fresh), at: 'start' } }
}

/** Enter in a list item: a new item with whatever followed the caret. Enter on an empty item leaves the list. */
export function enterInList(blocks: BlogBlock[], id: string, index: number, before: string, after: string): Edit {
  const i = blocks.findIndex(b => b.id === id)
  if (i === -1) return { blocks }
  const cur = blocks[i]
  const items = itemsOf(cur)
  if (!before.trim() && !after.trim()) {
    const head = items.slice(0, index)
    const rest = items.slice(index + 1)
    const fresh = newBlock('paragraph')
    const out: BlogBlock[] = []
    if (head.length) out.push(withData(cur, { items: head }))
    out.push(fresh)
    if (rest.length) out.push(newBlock(cur.type, { items: rest }))
    return { blocks: [...blocks.slice(0, i), ...out, ...blocks.slice(i + 1)], focus: { host: hostOf(fresh), at: 'start' } }
  }
  const next = [...items.slice(0, index), before, after, ...items.slice(index + 1)]
  return { blocks: [...blocks.slice(0, i), withData(cur, { items: next }), ...blocks.slice(i + 1)], focus: { host: `${cur.id}:i${index + 1}`, at: 'start' } }
}

/** Several lines pasted into a list item: each line becomes its own item. */
export function pasteItems(blocks: BlogBlock[], id: string, index: number, before: string, lines: string[], after: string): Edit {
  const i = blocks.findIndex(b => b.id === id)
  if (i === -1 || !lines.length) return { blocks }
  const cur = blocks[i]
  const items = itemsOf(cur)
  const last = lines.length - 1
  const added = lines.map((l, k) => (k === 0 ? before : '') + l + (k === last ? after : ''))
  const next = [...items.slice(0, index), ...added, ...items.slice(index + 1)]
  return { blocks: [...blocks.slice(0, i), withData(cur, { items: next }), ...blocks.slice(i + 1)], focus: { host: `${cur.id}:i${index + last}`, at: added[last].length - after.length } }
}

/** A bullet or number at the start of a pasted line is dropped (the list draws its own). */
export const stripListMark = (line: string) => line.replace(/^\s*(?:[•·▪◦●○*-]|\d{1,2}[.)])\s+/, '').trim()

/** Backspace at the start of a list item: joins the item above; the first item becomes a paragraph above the list. */
export function backspaceInList(blocks: BlogBlock[], id: string, index: number): Edit {
  const i = blocks.findIndex(b => b.id === id)
  if (i === -1) return { blocks }
  const cur = blocks[i]
  const items = itemsOf(cur)
  if (index > 0) {
    const at = items[index - 1].length
    const next = [...items.slice(0, index - 1), items[index - 1] + items[index], ...items.slice(index + 1)]
    return { blocks: [...blocks.slice(0, i), withData(cur, { items: next }), ...blocks.slice(i + 1)], focus: { host: `${cur.id}:i${index - 1}`, at } }
  }
  const fresh = newBlock('paragraph', { html: escapeHtml(items[0]) })
  const rest = items.slice(1)
  return { blocks: [...blocks.slice(0, i), fresh, ...(rest.length ? [withData(cur, { items: rest })] : []), ...blocks.slice(i + 1)], focus: { host: hostOf(fresh), at: 'start' } }
}

/** Backspace at the start of a paragraph, heading, quote or callout. */
export function backspaceRich(blocks: BlogBlock[], id: string): Edit {
  const i = blocks.findIndex(b => b.id === id)
  if (i === -1) return { blocks }
  const cur = blocks[i]
  const html = htmlOf(cur)
  const empty = !plainOfHtml(html).trim()
  const prev = i > 0 ? blocks[i - 1] : null
  // A styled block with words goes back to a plain paragraph first (the same step a word processor takes).
  if (!empty && cur.type !== 'paragraph') {
    const para: BlogBlock = { id: cur.id, type: 'paragraph', data: { html } }
    return { blocks: [...blocks.slice(0, i), para, ...blocks.slice(i + 1)], focus: { host: hostOf(para), at: 'start' } }
  }
  if (!prev) return empty && blocks.length > 1 ? { blocks: blocks.slice(1), focus: isText(blocks[1].type) ? { host: hostOf(blocks[1]), at: 'start' } : { select: blocks[1].id } } : { blocks }
  const without = [...blocks.slice(0, i), ...blocks.slice(i + 1)]
  if (isRich(prev.type)) {
    const prevHtml = htmlOf(prev)
    const at = plainOfHtml(prevHtml).length
    if (empty) return { blocks: without, focus: { host: hostOf(prev), at: 'end' } }
    const merged = withHtml(prev, prevHtml + html)
    return { blocks: [...blocks.slice(0, i - 1), merged, ...blocks.slice(i + 1)], focus: { host: hostOf(prev), at } }
  }
  if (isList(prev.type)) {
    const items = itemsOf(prev)
    const last = items.length - 1
    const at = items[last].length
    if (empty) return { blocks: without, focus: { host: `${prev.id}:i${last}`, at: 'end' } }
    const merged = withData(prev, { items: [...items.slice(0, last), items[last] + plainOfHtml(html).replace(/\n/g, ' ')] })
    return { blocks: [...blocks.slice(0, i - 1), merged, ...blocks.slice(i + 1)], focus: { host: `${prev.id}:i${last}`, at } }
  }
  // Above is a card (a photo, a payment example...): an empty line is removed and the card is picked.
  return empty ? { blocks: without, focus: { select: prev.id } } : { blocks, focus: { select: prev.id } }
}

/** Several paragraphs pasted at once: the block keeps the first, the rest follow as paragraphs. */
export function pasteParagraphs(blocks: BlogBlock[], id: string, html: string, more: string[], after: string): Edit {
  const i = blocks.findIndex(b => b.id === id)
  if (i === -1 || !more.length) return { blocks }
  const cur = blocks[i]
  const added = more.map((p, k) => paragraphLike(cur, k === more.length - 1 && after ? `${p} ${after}` : p))
  return { blocks: [...blocks.slice(0, i), withHtml(cur, html), ...added, ...blocks.slice(i + 1)], focus: { host: hostOf(added[added.length - 1]), at: 'end' } }
}

// ---------------------------------------------------------------------------
// "Turn into": one text style to another, keeping the words
// ---------------------------------------------------------------------------

const linesOfHtml = (html: string) => html.split(/<br\s*\/?>/i).map(l => plainOfHtml(l).replace(/^\s*[•·▪◦●○*-]\s+/, '').replace(/^\s*\d{1,2}[.)]\s+/, '').trim()).filter(Boolean)

export function convertBlock(blocks: BlogBlock[], id: string, to: BlockType): Edit {
  const i = blocks.findIndex(b => b.id === id)
  if (i === -1) return { blocks }
  const cur = blocks[i]
  if (cur.type === to || !isText(cur.type) || !isText(to)) return { blocks }
  let out: BlogBlock[]
  if (isList(cur.type)) {
    const items = itemsOf(cur).map(t => t.trim()).filter(Boolean)
    if (isList(to)) out = [{ ...cur, type: to }]
    else if (to === 'paragraph') out = items.length ? items.map((t, k) => ({ id: k === 0 ? cur.id : newId('paragraph'), type: 'paragraph' as BlockType, data: { html: escapeHtml(t) } })) : [{ id: cur.id, type: to, data: {} }]
    else out = [{ id: cur.id, type: to, data: { html: items.map(escapeHtml).join(SOFT_TYPES.includes(to) ? '<br>' : ' ') } }]
  } else if (isList(to)) {
    const lines = linesOfHtml(htmlOf(cur))
    out = [{ id: cur.id, type: to, data: { items: lines.length ? lines : [''] } }]
  } else {
    const html = htmlOf(cur)
    // Headings are one line.
    out = [{ id: cur.id, type: to, data: { html: to === 'heading' || to === 'subheading' ? html.replace(/<br\s*\/?>/gi, ' ') : html, ...(cur.data?.align ? { align: cur.data.align } : {}) } }]
  }
  const first = out[0]
  return { blocks: [...blocks.slice(0, i), ...out, ...blocks.slice(i + 1)], focus: { host: hostOf(first), at: 'end' } }
}

/** What typing a shortcut at the start of an empty paragraph turns it into ("- " a list, "## " a heading). */
export function shortcutType(text: string): BlockType | null {
  const t = text.replace(/\u00a0/g, ' ')
  if (t === '- ' || t === '* ' || t === '• ') return 'bulleted_list'
  if (t === '1. ' || t === '1) ') return 'numbered_list'
  if (t === '# ' || t === '## ') return 'heading'
  if (t === '### ') return 'subheading'
  if (t === '> ') return 'quote'
  return null
}

// ---------------------------------------------------------------------------
// Reading the page back into blocks
// ---------------------------------------------------------------------------

/** One typed value from the page ("html", "i3", "text", "caption") written into its block. */
export function applyHostValue(blocks: BlogBlock[], id: string, field: string, raw: string): BlogBlock[] {
  return blocks.map(b => {
    if (b.id !== id) return b
    if (field === 'html') {
      const html = sanitizeInlineHtml(raw)
      return htmlOf(b) === html && !b.data?.text ? b : withHtml(b, html)
    }
    if (/^i\d+$/.test(field)) {
      const n = Number(field.slice(1))
      const items = itemsOf(b)
      const value = cleanPlain(raw)
      if (items[n] === value) return b
      const next = [...items]
      next[n] = value
      return withData(b, { items: next })
    }
    const value = cleanPlain(raw)
    return b.data?.[field] === value ? b : withData(b, { [field]: value })
  })
}

/** The value a text spot on the page starts with. Rich text is HTML; everything else plain. */
export function hostValue(b: BlogBlock, field: string): { html?: string; text?: string } {
  if (field === 'html') return { html: sanitizeInlineHtml(htmlOf(b)) }
  if (/^i\d+$/.test(field)) return { text: itemsOf(b)[Number(field.slice(1))] ?? '' }
  return { text: String(b.data?.[field] ?? '') }
}

/** Pasted plain text -> one HTML string per paragraph. A run of bullet lines stays together as the
 *  lines of one paragraph - the shape the AI writer uses for its own short lists. */
export function pastedParagraphs(text: string): string[] {
  const out: string[] = []
  let bullets: string[] = []
  const flush = () => { if (bullets.length) { out.push(bullets.join('<br>')); bullets = [] } }
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line) { flush(); continue }
    const bullet = line.match(/^[•·▪◦●○*-]\s+(.+)$/)
    if (bullet) { bullets.push(escapeHtml(`• ${bullet[1]}`)); continue }
    if (/^\d{1,2}[.)]\s+\S/.test(line)) { bullets.push(escapeHtml(line)); continue }
    flush()
    out.push(escapeHtml(line))
  }
  flush()
  return out
}

/** Empty inline marks and stray breaks left at the cut when a block is split in two. */
export function cleanSplitEdge(html: string): string {
  return html
    .replace(/<(b|i|u|s|strong|em|strike|a)\b[^>]*>\s*<\/\1>/gi, '')
    .replace(/^(?:\s|&nbsp;|<br\s*\/?>)+|(?:\s|&nbsp;|<br\s*\/?>)+$/gi, '')
}

/** Does a block still need the agent to pick or add something before readers can see it? */
export function needsSetup(b: BlogBlock): string | null {
  const d = b.data || {}
  switch (b.type) {
    case 'image': return d.url ? null : 'Add a photo'
    case 'gallery': return (d.images || []).length ? null : 'Add photos'
    case 'youtube': return d.url ? null : 'Paste a YouTube link'
    case 'property_card': return d.property ? null : 'Pick a home'
    case 'area_spotlight': return d.area ? null : 'Pick a town'
    case 'lead_form': return d.formSlug ? null : 'Pick one of your forms'
    case 'qr_code': return d.url ? null : 'Add the link the code opens'
    case 'button': return (d.url || '').trim() ? null : 'Add the link the button opens'
    case 'property_showcase': return (d.properties || []).length ? null : 'Pick the homes to show'
    case 'video_showcase': return (d.videos || []).length ? null : 'Pick the videos to show'
    default: return null
  }
}
