'use client'

// The blog editor's page: the article exactly as readers will see it (its look, its color, light or
// dark), and every part of it editable right there. Click any words and type; Enter in a list adds
// the next point; pick a section to move, copy, restyle or remove it; drag new sections in from the
// "Add a section" panel. It saves the same `blocks` list the AI writer makes, through the page's
// own autosave, so the published article, old articles and the PDF all read it unchanged.
//
// How it stays identical to the published page: the article is drawn by the real reader components
// (BlogThemedArticle + BlogArticleBody) with editing switched on, never by a look-alike. This file
// only listens for typing and clicks on that page and draws the editing chrome on top of it.

import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlignCenter, AlignLeft, ArrowDown, ArrowUp, Bold, Check, ChevronDown, Copy, EyeOff, GripVertical, ImagePlus, Italic, Link2, Link2Off,
  Loader2, Moon, Pencil, Plus, Redo2, RotateCcw, Sparkles, Strikethrough, Sun, Trash2, Type, Underline, Undo2, X,
} from 'lucide-react'
import type { Blog, BlogBlock } from '@/types'
import { aiUsesLine, type AiShare } from '@/lib/studio/aiShare'
import BlogArticleBody, { visibleBlocks, type BlogArticleAgentInfo, type BlogEditHooks, type NeighborhoodLink } from '@/components/studio/blogs/BlogArticleBody'
import { BlogThemedArticle, blogAccent, blogSignatureMatch, blogTheme } from '@/components/studio/blogs/BlogThemes'
import { PopupSheet, usePhoneWidth } from '@/components/ui/AnchoredPopup'
import { sanitizeInlineHtml } from '@/lib/studio/sanitizeHtml'
import BlockPalette, { type PaletteItem } from './BlockPalette'
import BlockSettings, { hasSettings } from './BlockSettings'
import {
  CLOSING_TYPES, SINGLE_TYPES, SOFT_TYPES, TAIL_TYPES, applyHostValue, backspaceInList, backspaceRich, canStep, clampDrop, cleanPlain, cleanSplitEdge,
  convertBlock, defaultInsertIndex, duplicateUnit, enterInList, exitBox, hostValue, insertAt, isList, isRich, isText, labelOf, moveUnit, needsSetup,
  newBlock, pasteItems, pasteParagraphs, pastedParagraphs, plainOf, plainOfHtml, removeBlock, removeUnit, sectionOwners, shortcutType, splitRich,
  stampEdited, canRefine, stepUnit, stripListMark, tailStart, unitRange, withHtml, type BlockType, type Focus,
} from './blockOps'
import { caretAtEnd, caretAtStart, offsetFromPoint, parseHost, rangeIn, setCaret, splitAtCaret, tidyEmpty } from './domText'

const READER_KEY = 'ohp-blog-reader-mode'

const EDIT_CSS = `
[data-editing] [data-host]{outline:none;cursor:text;-webkit-tap-highlight-color:transparent}
[data-editing] [data-host]:empty::before{content:attr(data-ph);opacity:.38;pointer-events:none}
/* A section heading keeps its ::before for the look's own gold bar (4px wide in Classic and Midnight): its "type here"
   hint goes in ::after, or the hint was squeezed into the bar and stood one letter per line (11/16). */
[data-editing] h2[data-host]:empty::before{content:"";opacity:1}
[data-editing] h2[data-host]:empty::after{content:attr(data-ph);opacity:.38;pointer-events:none}
[data-editing] [data-host] a{cursor:text}
[data-editing] iframe{pointer-events:none}
[data-editing] ::selection{background:rgba(201,162,77,.34)}
[data-blog-line]{outline:none;cursor:text}
[data-blog-line]:empty::before{content:attr(data-ph);opacity:.42;pointer-events:none}
`


const TURN_INTO: { type: BlockType; label: string }[] = [
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'heading', label: 'Heading' },
  { type: 'subheading', label: 'Subheading' },
  { type: 'bulleted_list', label: 'Bullet points' },
  { type: 'numbered_list', label: 'Numbered steps' },
  { type: 'callout', label: 'Tip / fun fact box' },
  { type: 'quote', label: 'Pull quote' },
]

type Box = { top: number; left: number; width: number; height: number }
const pageBox = (el: Element): Box => {
  const r = el.getBoundingClientRect()
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height }
}
const sameBox = (a: Box | null, b: Box | null) => a === b || (!!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5)
const barBottom = () => (document.querySelector('[data-blog-topbar]') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0

// ---------------------------------------------------------------------------
// Title and subtitle: typed in place, in the look's own type
// ---------------------------------------------------------------------------

function EditableTitle({ value, styled, onChange, onEnter }: { value: string; styled: React.ReactNode; onChange: (v: string) => void; onEnter: () => void }) {
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  const at = useRef<number | 'end'>('end')
  useLayoutEffect(() => {
    if (!editing || !ref.current) return
    ref.current.textContent = value
    setCaret(ref.current, at.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])
  if (!editing) {
    // Shown the way readers see it (the look styles the last word); a click swaps in plain text to type over.
    return (
      <span key="view" role="textbox" tabIndex={0} aria-label="Article title - click to edit" data-blog-title
        className="cursor-text rounded-lg outline-none transition-shadow hover:shadow-[0_0_0_2px_rgba(201,162,77,.45)] focus-visible:shadow-[0_0_0_2px_rgba(201,162,77,.8)]"
        onClick={e => { at.current = offsetFromPoint(e.currentTarget, e.clientX, e.clientY) ?? 'end'; setEditing(true) }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); at.current = 'end'; setEditing(true) } }}>
        {value.trim() ? styled : <span className="opacity-40">Untitled Article</span>}
      </span>
    )
  }
  return (
    <span key="edit" ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label="Article title" data-blog-line="" data-blog-title data-ph="Untitled Article"
      className="inline-block min-w-[3ch] max-w-full rounded-lg shadow-[0_0_0_2px_rgba(201,162,77,.8)]"
      onInput={e => onChange(cleanPlain(e.currentTarget.textContent || ''))}
      onBlur={() => setEditing(false)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); onEnter() }
        if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) e.preventDefault()
      }}
      onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, cleanPlain(e.clipboardData.getData('text/plain') || '')) }} />
  )
}

function EditableLine({ value, placeholder, label, onChange }: { value: string; placeholder: string; label: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.textContent !== value) el.textContent = value
  }, [value])
  return (
    <span ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-label={label} data-blog-line="" data-ph={placeholder}
      className="block rounded-lg transition-shadow hover:shadow-[0_0_0_2px_rgba(201,162,77,.35)] focus:shadow-[0_0_0_2px_rgba(201,162,77,.7)]"
      onInput={e => onChange(cleanPlain(e.currentTarget.textContent || ''))}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        if ((e.metaKey || e.ctrlKey) && ['b', 'i', 'u'].includes(e.key.toLowerCase())) e.preventDefault()
      }}
      onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, cleanPlain(e.clipboardData.getData('text/plain') || '')) }} />
  )
}

// ---------------------------------------------------------------------------
// Bold / italic / link: one small bar under whatever words are selected
// ---------------------------------------------------------------------------

function TextToolbar({ root }: { root: RefObject<HTMLDivElement | null> }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const saved = useRef<Range | null>(null)
  const linking = useRef(false)
  linking.current = link !== null

  useEffect(() => {
    const update = () => {
      if (linking.current) return
      const sel = window.getSelection()
      const container = root.current
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !container) { setAt(null); return }
      const range = sel.getRangeAt(0)
      const node = range.commonAncestorContainer
      const el = (node.nodeType === 1 ? node : node.parentElement) as HTMLElement | null
      const host = el?.closest('[data-host]') as HTMLElement | null
      // Bold and links live in paragraphs, headings, quotes and boxes. List points are plain text, like the AI writes them.
      if (!host || !container.contains(host) || !host.dataset.host?.endsWith(':html')) { setAt(null); return }
      const box = range.getBoundingClientRect()
      if (!box.width && !box.height) { setAt(null); return }
      const half = 120
      setAt({ top: box.bottom + window.scrollY + 8, left: Math.max(half + 8, Math.min(window.innerWidth - half - 8, box.left + box.width / 2)) + window.scrollX })
      bump()
    }
    document.addEventListener('selectionchange', update)
    return () => document.removeEventListener('selectionchange', update)
  }, [root])

  if (!at || typeof document === 'undefined') return null
  const exec = (command: string, value?: string) => { document.execCommand(command, false, value); bump() }
  const active = (command: string) => { try { return document.queryCommandState(command) } catch { return false } }
  const inLink = () => {
    const sel = window.getSelection()
    const n = sel?.anchorNode
    return !!(n && (n.nodeType === 1 ? (n as HTMLElement) : n.parentElement)?.closest('a'))
  }
  // Back to the words that were selected before the link box took the keyboard.
  const restore = () => {
    const sel = window.getSelection()
    const r = saved.current
    if (!r || !sel) return
    const node = r.commonAncestorContainer
    ;((node.nodeType === 1 ? node : node.parentElement) as HTMLElement | null)?.closest<HTMLElement>('[data-host]')?.focus({ preventScroll: true })
    sel.removeAllRanges()
    sel.addRange(r)
  }
  const applyLink = () => {
    let url = (link || '').trim()
    restore()
    setLink(null)
    if (!url) return
    if (!/^(https?:|mailto:)/i.test(url)) url = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url) ? `mailto:${url}` : `https://${url}`
    exec('createLink', url)
  }
  const btn = (on: boolean) => `grid h-9 w-9 place-items-center rounded-lg transition sm:h-8 sm:w-8 ${on ? 'bg-white/15 text-white' : 'text-white/65 hover:bg-white/10 hover:text-white'}`
  return createPortal(
    <div data-blog-editor-ui className="absolute z-[27] flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-black/40 bg-[#111827] p-1 shadow-2xl" style={{ top: at.top, left: at.left }} onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault() }}>
      {link !== null ? (
        <form className="flex items-center gap-1" onSubmit={e => { e.preventDefault(); applyLink() }}>
          <input autoFocus value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { restore(); setLink(null) } }} placeholder="Paste or type a link" aria-label="Link"
            className="h-8 w-52 rounded-lg bg-white/10 px-2.5 text-xs font-semibold text-white outline-none placeholder:text-white/40" />
          <button type="submit" aria-label="Add link" className="grid h-8 w-8 place-items-center rounded-lg bg-[#C9A24D] text-[#111827]"><Check className="h-4 w-4" strokeWidth={3} /></button>
          <button type="button" aria-label="Cancel" onClick={() => { restore(); setLink(null) }} className={btn(false)}><X className="h-4 w-4" /></button>
        </form>
      ) : (
        <>
          <button type="button" title="Bold" aria-label="Bold" onClick={() => exec('bold')} className={btn(active('bold'))}><Bold className="h-4 w-4" /></button>
          <button type="button" title="Italic" aria-label="Italic" onClick={() => exec('italic')} className={btn(active('italic'))}><Italic className="h-4 w-4" /></button>
          <button type="button" title="Underline" aria-label="Underline" onClick={() => exec('underline')} className={btn(active('underline'))}><Underline className="h-4 w-4" /></button>
          <button type="button" title="Strikethrough" aria-label="Strikethrough" onClick={() => exec('strikeThrough')} className={btn(active('strikeThrough'))}><Strikethrough className="h-4 w-4" /></button>
          <span className="mx-0.5 h-4 w-px bg-white/15" />
          {inLink() ? (
            <button type="button" title="Remove link" aria-label="Remove link" onClick={() => exec('unlink')} className={btn(true)}><Link2Off className="h-4 w-4" /></button>
          ) : (
            <button type="button" title="Link" aria-label="Link" onClick={() => { const sel = window.getSelection(); saved.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null; setLink('') }} className={btn(false)}><Link2 className="h-4 w-4" /></button>
          )}
        </>
      )}
    </div>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

export interface BlogCanvasEditorProps {
  blog: Blog
  /** The agent as the article shows them (photo, name, brokerage, phone, email). */
  agent: BlogArticleAgentInfo
  /** The agent's Agent Hub slug when their email signature closes the article. */
  signatureHubSlug: string | null
  signatureOn: boolean
  signatureTowns?: string[]
  forms?: { formType: string; slug: string; title?: string }[]
  formHref?: (slug: string) => string
  neighborhoodLinks?: NeighborhoodLink[]
  /** Saves the article's sections (the page autosaves). */
  onBlocks: (blocks: BlogBlock[]) => void
  onMeta: (patch: { title?: string; subtitle?: string }) => void
  /** Cover, look and color live on the "Look & cover" tab. */
  onOpenLook: () => void
  onOpenPublish: () => void
  /** AI "Refine" for a section, or for one passage the agent wrote (paid AI - the page runs it). */
  refineBusy: string | null
  onRefine: (id: string) => void
  /** About what one Refine uses, said on the button's menu before it is pressed. */
  refineEstimate?: AiShare | null
}

type Menu = null | 'style' | 'delete' | 'refine' | 'settings'
type DragWhat = { kind: 'move'; id: string } | { kind: 'new'; item: PaletteItem }
type DragView = { label: string; x: number; y: number; line: Box | null }

export default function BlogCanvasEditor(props: BlogCanvasEditorProps) {
  const { blog } = props
  const theme = blogTheme(blog.theme)
  const accent = blogAccent(blog.theme, blog.luxe_metal, blog.accent_color)
  const phone = usePhoneWidth()
  const [, rerender] = useReducer((n: number) => n + 1, 0)
  // Bumped whenever the article has to be drawn again (a section added, moved, restyled). Plain
  // typing never bumps it: the words are already on the page, so the article is not redrawn per key.
  const [version, redraw] = useReducer((n: number) => n + 1, 0)

  // --- the article's sections ------------------------------------------------
  const blocksRef = useRef<BlogBlock[]>(blog.blocks)
  const seenProp = useRef<BlogBlock[]>(blog.blocks)
  const reseed = useRef<'all' | null>(null)
  const past = useRef<BlogBlock[][]>([])
  const future = useRef<BlogBlock[][]>([])
  const typing = useRef<{ host: string; t: number; since: number } | null>(null)
  const pendingFocus = useRef<Focus | null>(null)
  const pendingReveal = useRef<string | null>(null)
  const outside = useRef(0)
  const propsRef = useRef(props)
  propsRef.current = props
  if (blog.blocks !== seenProp.current) {
    seenProp.current = blog.blocks
    // Changed from outside this editor (the AI refined a section, a new draft arrived): show it.
    if (blog.blocks !== blocksRef.current) { past.current.push(blocksRef.current); blocksRef.current = blog.blocks; reseed.current = 'all'; typing.current = null; outside.current += 1 }
  }

  const rootRef = useRef<HTMLDivElement | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [menu, setMenu] = useState<Menu>(null)
  const [palette, setPalette] = useState<{ open: boolean; replace?: string; at?: number }>({ open: false })
  const [snack, setSnack] = useState<{ text: string; undo?: boolean; key: number } | null>(null)
  const [drag, setDrag] = useState<DragView | null>(null)
  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selected
  const menuRef = useRef<Menu>(null)
  menuRef.current = menu
  // While the agent is typing, the toolbar steps out of the way (it sits just above the paragraph,
  // over the end of the line before it). Moving the mouse or tapping brings it back.
  const [quiet, setQuiet] = useState(false)
  const quietRef = useRef(false)
  quietRef.current = quiet
  useEffect(() => {
    const wake = () => { if (quietRef.current) setQuiet(false) }
    const move = (e: MouseEvent) => { if (quietRef.current && Math.abs(e.movementX) + Math.abs(e.movementY) > 2) setQuiet(false) }
    window.addEventListener('pointerdown', wake, true)
    window.addEventListener('mousemove', move)
    return () => { window.removeEventListener('pointerdown', wake, true); window.removeEventListener('mousemove', move) }
  }, [])
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canHover = useRef(false)
  useEffect(() => { canHover.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches }, [])

  // --- reading mode (the same Light / Dark choice readers get) ------------------
  const natural: 'light' | 'dark' = theme.id === 'midnight' ? 'dark' : 'light'
  const [modePref, setModePref] = useState<'light' | 'dark' | null>(null)
  useEffect(() => { try { const v = localStorage.getItem(READER_KEY); if (v === 'light' || v === 'dark') setModePref(v) } catch { /* private mode */ } }, [])
  const mode = modePref || natural
  const setMode = (m: 'light' | 'dark') => { setModePref(m); try { localStorage.setItem(READER_KEY, m) } catch { /* private mode */ } }

  const say = (text: string, undo = false) => setSnack({ text, undo, key: Date.now() })
  useEffect(() => {
    if (!snack) return
    const t = setTimeout(() => setSnack(s => (s && s.key === snack.key ? null : s)), snack.undo ? 7000 : 4500)
    return () => clearTimeout(t)
  }, [snack])

  // --- saving an edit -----------------------------------------------------------
  const commit = (next: BlogBlock[], opts: { focus?: Focus; reseed?: boolean; typingHost?: string; draw?: boolean } = {}) => {
    const prev = blocksRef.current
    // The agent changed the words of something the AI wrote: it is theirs now (this is what "Refine with AI" goes by).
    next = stampEdited(prev, next)
    if (next !== prev) {
      const now = Date.now()
      if (opts.typingHost) {
        // One undo step per burst of typing, not per letter.
        const t = typing.current
        if (!t || t.host !== opts.typingHost || now - t.t > 1500 || now - t.since > 6000) { past.current.push(prev); typing.current = { host: opts.typingHost, t: now, since: now } }
        else t.t = now
      } else { past.current.push(prev); typing.current = null }
      if (past.current.length > 80) past.current.shift()
      future.current = []
      blocksRef.current = next
      propsRef.current.onBlocks(next)
    }
    if (opts.reseed) reseed.current = 'all'
    if (opts.focus) pendingFocus.current = opts.focus
    if (opts.draw ?? !opts.typingHost) redraw()
    else rerender()
  }
  const undo = () => {
    const prev = past.current.pop()
    if (!prev) { say('Nothing to undo'); return }
    future.current.push(blocksRef.current)
    blocksRef.current = prev
    typing.current = null
    reseed.current = 'all'
    propsRef.current.onBlocks(prev)
    redraw()
  }
  const redo = () => {
    const next = future.current.pop()
    if (!next) return
    past.current.push(blocksRef.current)
    blocksRef.current = next
    typing.current = null
    reseed.current = 'all'
    propsRef.current.onBlocks(next)
    redraw()
  }

  // --- finding sections on the page ------------------------------------------------
  const elOf = (id: string | null): HTMLElement | null => {
    const root = rootRef.current
    if (!root || !id) return null
    const marker = root.querySelector(`:scope > [data-bm="${CSS.escape(id)}"]`)
    const el = marker?.nextElementSibling as HTMLElement | null
    return el && !el.hasAttribute('data-bm') ? el : null
  }
  const idFrom = (target: EventTarget | null): string | null => {
    const root = rootRef.current
    let el = target as HTMLElement | null
    if (!root || !el || !root.contains(el) || el === root) return null
    while (el && el.parentElement !== root) el = el.parentElement
    return (el?.previousElementSibling as HTMLElement | null)?.dataset?.bm || null
  }
  const hostFrom = (target: EventTarget | null): HTMLElement | null => {
    const el = (target as HTMLElement | null)?.closest?.('[data-host]') as HTMLElement | null
    return el && rootRef.current?.contains(el) ? el : null
  }
  const blockOf = (id: string | null) => (id ? blocksRef.current.find(b => b.id === id) || null : null)

  // --- after every draw: fill in new text spots, then put the caret where the edit left it ---
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const all = reseed.current === 'all'
    const byId = new Map(blocksRef.current.map(b => [b.id, b]))
    root.querySelectorAll<HTMLElement>('[data-host]').forEach(el => {
      if ((el as any).__seeded && !all) return
      const { id, field } = parseHost(el.dataset.host || '')
      const b = byId.get(id)
      if (!b) return
      const v = hostValue(b, field)
      if (v.html !== undefined) { if (el.innerHTML !== v.html) el.innerHTML = v.html }
      else if (el.textContent !== v.text) el.textContent = v.text || ''
      ;(el as any).__seeded = true
    })
    reseed.current = null
    const f = pendingFocus.current
    pendingFocus.current = null
    if (f) {
      if ('select' in f) { (document.activeElement as HTMLElement | null)?.blur?.(); setSelected(f.select) }
      else {
        const host = root.querySelector<HTMLElement>(`[data-host="${CSS.escape(f.host)}"]`)
        if (host) { setCaret(host, f.at); setSelected(parseHost(f.host).id) }
      }
    }
    const reveal = pendingReveal.current
    pendingReveal.current = null
    if (reveal) {
      const el = elOf(reveal)
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.top < barBottom() + 60 || r.bottom > window.innerHeight - 90) window.scrollTo({ top: Math.max(0, r.top + window.scrollY - window.innerHeight * 0.35), behavior: 'smooth' })
      }
    }
  })

  // --- typing --------------------------------------------------------------------------------
  const onInput = (e: React.FormEvent) => {
    const host = hostFrom(e.target)
    if (!host) return
    const key = host.dataset.host || ''
    const { id, field } = parseHost(key)
    const cur = blockOf(id)
    if (!cur) return
    if (!quietRef.current) setQuiet(true)
    tidyEmpty(host)
    if (field === 'html' && cur.type === 'paragraph') {
      const text = host.textContent || ''
      // "- " starts a list, "## " a heading, "> " a quote - the shortcuts people already know.
      const to = shortcutType(text)
      if (to) {
        const ed = convertBlock(blocksRef.current.map(b => (b.id === id ? withHtml(b, '') : b)), id, to)
        commit(ed.blocks, { focus: ed.focus, reseed: true })
        return
      }
      if (text === '/') setPalette({ open: true, replace: id })
      else if (palette.replace === id) setPalette({ open: false })
    }
    commit(applyHostValue(blocksRef.current, id, field, field === 'html' ? host.innerHTML : host.textContent || ''), { typingHost: key })
  }

  const neighborHost = (host: HTMLElement, dir: -1 | 1): HTMLElement | null => {
    const hosts = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-host]') || [])
    return hosts[hosts.indexOf(host) + dir] || null
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key.toLowerCase()
    const mod = e.metaKey || e.ctrlKey
    if (mod && !e.altKey && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
    if (mod && !e.altKey && k === 'y') { e.preventDefault(); redo(); return }
    const host = hostFrom(e.target)
    if (!host) return
    const { id, field } = parseHost(host.dataset.host || '')
    const blocks = blocksRef.current
    const cur = blockOf(id)
    if (!cur) return
    const rich = field === 'html'
    const item = /^i\d+$/.test(field) ? Number(field.slice(1)) : -1
    if (mod && ['b', 'i', 'u'].includes(k) && !rich) { e.preventDefault(); return }
    const range = rangeIn(host)
    if ((e.key === 'Enter' || e.key === 'Backspace') && !quietRef.current) setQuiet(true)

    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return
      e.preventDefault()
      const parts = splitAtCaret(host)
      if (!parts) return
      if (item >= 0) {
        const ed = enterInList(blocks, id, item, cleanPlain(parts.before), cleanPlain(parts.after))
        commit(ed.blocks, { focus: ed.focus, reseed: true })
        return
      }
      if (!rich) return // a caption and the small print are one line
      const soft = SOFT_TYPES.includes(cur.type)
      if (soft || e.shiftKey) {
        if (cur.type === 'heading' || cur.type === 'subheading') return
        const lastLine = plainOfHtml(parts.beforeHtml.split(/<br\s*\/?>/i).pop() || '')
        const bullet = /^\s*[•·]/.test(lastLine)
        const lineEmpty = !lastLine.replace(/^\s*[•·]/, '').trim()
        if (soft && !e.shiftKey && !parts.after.trim() && lineEmpty) {
          // Enter on an empty last line (or an empty bullet) leaves the box.
          const kept = cleanSplitEdge(sanitizeInlineHtml(parts.beforeHtml).replace(/(?:<br>)?\s*[•·]?(?:&nbsp;|\s)*$/i, ''))
          const ed = plainOfHtml(kept).trim() ? exitBox(blocks, id, kept) : convertBlock(blocks.map(b => (b.id === id ? withHtml(b, '') : b)), id, 'paragraph')
          commit(ed.blocks, { focus: ed.focus, reseed: true })
          return
        }
        document.execCommand('insertLineBreak')
        // A line that starts with a bullet is followed by another bullet.
        if (bullet) document.execCommand('insertText', false, '• ')
        return
      }
      const ed = splitRich(blocks, id, cleanSplitEdge(sanitizeInlineHtml(parts.beforeHtml)), cleanSplitEdge(sanitizeInlineHtml(parts.afterHtml)))
      commit(ed.blocks, { focus: ed.focus, reseed: true })
      return
    }

    if (e.key === 'Backspace' && range && range.collapsed && caretAtStart(host, range)) {
      if (item >= 0) {
        e.preventDefault()
        const ed = backspaceInList(blocks, id, item)
        commit(ed.blocks, { focus: ed.focus, reseed: true })
      } else if (rich) {
        e.preventDefault()
        const ed = backspaceRich(blocks, id)
        commit(ed.blocks, { focus: ed.focus, reseed: true })
      } else if (field === 'text' && !(host.textContent || '').length) {
        e.preventDefault()
        removeOne(id)
      }
      return
    }

    if (e.shiftKey || mod || !range || !range.collapsed) return
    if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && caretAtStart(host, range)) {
      const prev = neighborHost(host, -1)
      if (prev) { e.preventDefault(); setCaret(prev, 'end') }
    } else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && caretAtEnd(host, range)) {
      const next = neighborHost(host, 1)
      if (next) { e.preventDefault(); setCaret(next, 'start') }
    } else if (e.key === 'Escape') host.blur()
  }

  // Paste arrives as plain text: copied fonts, sizes and colors never reach the article, and each
  // pasted paragraph becomes a paragraph (or list point) in the article's own style.
  const onPaste = (e: React.ClipboardEvent) => {
    const host = hostFrom(e.target)
    if (!host) return
    e.preventDefault()
    const text = (e.clipboardData.getData('text/plain') || '').replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ')
    if (!text.trim()) return
    const { id, field } = parseHost(host.dataset.host || '')
    const blocks = blocksRef.current
    const cur = blockOf(id)
    if (!cur) return
    if (field !== 'html') {
      const lines = text.split('\n').map(stripListMark).filter(Boolean)
      const parts = /^i\d+$/.test(field) && lines.length > 1 ? splitAtCaret(host) : null
      if (parts) {
        const ed = pasteItems(blocks, id, Number(field.slice(1)), cleanPlain(parts.before), lines, cleanPlain(parts.after))
        commit(ed.blocks, { focus: ed.focus, reseed: true })
      } else document.execCommand('insertText', false, lines.join(' '))
      return
    }
    const paragraphs = pastedParagraphs(text)
    if (!paragraphs.length) return
    if (paragraphs.length > 1 && cur.type === 'paragraph') {
      const parts = splitAtCaret(host)
      if (parts) {
        const before = cleanSplitEdge(sanitizeInlineHtml(parts.beforeHtml))
        const ed = pasteParagraphs(blocks, id, before + (before && /\s$/.test(parts.before) ? ' ' : '') + paragraphs[0], paragraphs.slice(1), cleanSplitEdge(sanitizeInlineHtml(parts.afterHtml)))
        commit(ed.blocks, { focus: ed.focus, reseed: true })
        return
      }
    }
    const oneLine = cur.type === 'heading' || cur.type === 'subheading'
    document.execCommand('insertHTML', false, paragraphs.map(p => (oneLine ? p.replace(/<br>/g, ' ') : p)).join(oneLine ? ' ' : '<br>'))
  }

  // --- picking sections ------------------------------------------------------------------
  const pick = (id: string | null) => {
    if (id && !blockOf(id)) {
      // Added by the page itself, not a section of the article.
      if (id === 'auto-signature') say('Your email signature card closes the article. Turn it off in Review and Publish.')
      else if (id === 'auto-neighborhoods') say('These town links are added for you. Change them in Review and Publish.')
      return
    }
    if (id !== selectedRef.current) setMenu(null)
    setSelected(id)
  }
  const onFocus = (e: React.FocusEvent) => { const host = hostFrom(e.target); if (host) pick(parseHost(host.dataset.host || '').id) }
  const onMouseDownCapture = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (hostFrom(t) || t.closest('[data-blog-editor-ui]')) return
    const id = idFrom(t)
    if (!id) return
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    pick(id)
  }
  // A card's own buttons and links don't run while editing: a click picks the card instead.
  const onClickCapture = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement
    if (t.closest('[data-blog-editor-ui]')) return
    if (hostFrom(t)) { if (t.closest('a')) e.preventDefault(); return }
    if (t.closest('summary')) return
    if (!idFrom(t)) return
    e.preventDefault()
    e.stopPropagation()
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!canHover.current || drag) return
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null }
    const id = idFrom(e.target)
    if (id && blockOf(id) && id !== hover) setHover(id)
  }
  const fadeHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => setHover(null), 260)
  }
  const keepHover = () => { if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null } }

  const handlers = useRef<Record<string, (e: any) => void>>({})
  handlers.current = { onInput, onKeyDown, onPaste, onFocus, onMouseDownCapture, onClickCapture, onMouseMove, onMouseLeave: fadeHover }

  // --- hidden sections / sections that still need something ------------------------------------
  const derived = useRef<{ blocks: BlogBlock[] | null; owners: Record<string, string | null>; shown: Set<string> }>({ blocks: null, owners: {}, shown: new Set() })
  const info = () => {
    const d = derived.current
    if (d.blocks !== blocksRef.current) {
      d.blocks = blocksRef.current
      d.owners = sectionOwners(blocksRef.current)
      d.shown = new Set(visibleBlocks(blocksRef.current).map(b => b.id))
    }
    return d
  }
  const hiddenUnder = (b: BlogBlock) => { const owner = info().owners[b.id]; return !!owner && !!blockOf(owner)?.data?.hidden }

  const update = (id: string, updater: (b: BlogBlock) => BlogBlock, typingKey?: string) => {
    commit(blocksRef.current.map(b => (b.id === id ? updater(b) : b)), { typingHost: typingKey, draw: true })
  }
  const setHidden = (id: string, hidden: boolean) => {
    update(id, b => ({ ...b, data: { ...(b.data || {}), hidden } }))
    setMenu(null)
    if (hidden) { setSelected(null); say('Section hidden from readers', true) }
  }

  const edit: BlogEditHooks = useMemo(() => {
    const on = (name: string) => (e: any) => handlers.current[name]?.(e)
    return {
      rootProps: {
        ref: rootRef, 'data-editing': '', onInput: on('onInput'), onKeyDown: on('onKeyDown'), onPaste: on('onPaste'), onFocus: on('onFocus'),
        onMouseDownCapture: on('onMouseDownCapture'), onClickCapture: on('onClickCapture'), onMouseMove: on('onMouseMove'), onMouseLeave: on('onMouseLeave'),
        onDragStart: (e: React.DragEvent) => e.preventDefault(),
      },
      host: (block, field, placeholder) => ({
        contentEditable: true, suppressContentEditableWarning: true, spellCheck: true, role: 'textbox', 'aria-label': placeholder,
        'data-host': `${block.id}:${field}`, 'data-ph': placeholder,
      }),
      replace: block => {
        if (!blockOf(block.id)) return undefined
        if (hiddenUnder(block)) return null
        if (block.type === 'heading' && block.data?.hidden) {
          const r = unitRange(blocksRef.current, block.id)
          const count = r ? r[1] - r[0] - 1 : 0
          return (
            <div data-blog-editor-ui className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/80 px-4 py-3 dark:border-white/15 dark:bg-white/[0.03]">
              <EyeOff className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Hidden from readers</p>
                <p className="truncate text-sm font-black text-gray-500 line-through decoration-gray-300 dark:text-gray-400">{plainOf(block).trim() || 'Untitled section'}{count ? ` · ${count} more` : ''}</p>
              </div>
              <button type="button" onClick={() => setHidden(block.id, false)} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#111827] px-3.5 text-[11px] font-black text-[#e8c97a] transition hover:-translate-y-0.5 dark:bg-white/10"><RotateCcw className="h-3 w-3" /> Show again</button>
              <button type="button" onClick={() => { commit(removeUnit(blocksRef.current, block.id), {}); say('Section deleted', true) }} aria-label="Delete this section" title="Delete this section" className="grid h-9 w-9 place-items-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
            </div>
          )
        }
        const need = block.type === 'button' ? null : needsSetup(block)
        if (!need) return undefined
        return (
          <button type="button" data-blog-editor-ui onClick={() => { setSelected(block.id); setMenu('settings') }}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition hover:-translate-y-0.5"
            style={{ borderColor: `${accent}88`, background: `${accent}0f` }}>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111827] text-[#e8c97a] shadow-lg"><ImagePlus className="h-5 w-5" /></span>
            <span className="font-serif text-lg font-black text-[#111827] dark:text-white">{labelOf(block)}</span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{need}. Readers won&apos;t see this section until you do.</span>
          </button>
        )
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent])

  // --- section actions -------------------------------------------------------------------------
  const removeOne = (id: string) => {
    const blocks = blocksRef.current
    const i = blocks.findIndex(b => b.id === id)
    if (i === -1) return
    const near = blocks[i - 1] || blocks[i + 1] || null
    commit(removeBlock(blocks, id), { focus: near ? (isText(near.type) && i > 0 ? { host: isList(near.type) ? `${near.id}:i${Math.max(0, (near.data?.items?.length || 1) - 1)}` : `${near.id}:html`, at: 'end' } : { select: near.id }) : undefined, reseed: true })
    setMenu(null)
    say(`${labelOf(blocks[i])} removed`, true)
  }
  const removeSection = (id: string) => {
    commit(removeUnit(blocksRef.current, id), { reseed: true })
    setSelected(null)
    setMenu(null)
    say('Section deleted', true)
  }
  const step = (id: string, dir: -1 | 1) => { pendingReveal.current = id; commit(stepUnit(blocksRef.current, id, dir), { reseed: true }) }
  const duplicate = (id: string) => {
    const d = duplicateUnit(blocksRef.current, id)
    if (!d) return
    pendingReveal.current = d.firstId
    commit(d.blocks, { focus: { select: d.firstId }, reseed: true })
  }
  const turnInto = (id: string, type: BlockType) => {
    const ed = convertBlock(blocksRef.current, id, type)
    commit(ed.blocks, { focus: ed.focus, reseed: true })
    setMenu(null)
  }
  const styleOf = (id: string, patch: Record<string, any>) => update(id, b => ({ ...b, data: { ...(b.data || {}), ...patch } }))

  /** Where a tapped section from the palette lands. */
  const insertIndexFor = (made: BlogBlock[]): number => {
    const blocks = blocksRef.current
    if (palette.at !== undefined) return palette.at
    const first = made[0].type
    const sel = selectedRef.current
    const i = sel ? blocks.findIndex(b => b.id === sel) : -1
    if (i >= 0) {
      // A new section goes after the whole section you're in; anything else goes right under what you picked.
      if (first === 'heading') {
        const owner = blocks[i].type === 'heading' ? blocks[i].id : info().owners[blocks[i].id]
        const r = owner ? unitRange(blocks, owner) : null
        if (r) return r[1]
      }
      const r = blocks[i].type === 'heading' && blocks[i].data?.hidden ? unitRange(blocks, blocks[i].id) : null
      return r ? r[1] : i + 1
    }
    if (!TAIL_TYPES.includes(first)) return defaultInsertIndex(blocks)
    // An ending piece goes to its usual place: sales and videos above the closing button, the contact card after it.
    const tail = tailStart(blocks)
    const firstOf = (types: BlockType[]) => blocks.findIndex((b, k) => k >= tail && types.includes(b.type))
    const order: BlockType[][] = first === 'property_showcase' || first === 'video_showcase' ? [CLOSING_TYPES, ['related_articles', 'disclaimer']]
      : first === 'cta' ? [['agent_profile'], ['related_articles', 'disclaimer']]
        : first === 'agent_profile' ? [['related_articles', 'disclaimer']]
          : first === 'related_articles' ? [['disclaimer']] : []
    for (const types of order) { const at = firstOf(types); if (at >= 0) return at }
    return blocks.length
  }
  const addBlocks = (made: BlogBlock[], index: number, replaceId?: string) => {
    let blocks = blocksRef.current
    let at = index
    if (replaceId) {
      const i = blocks.findIndex(b => b.id === replaceId)
      if (i >= 0) { blocks = removeBlock(blocks, replaceId); at = i }
    }
    const next = insertAt(blocks, at, made)
    const first = made[0]
    pendingReveal.current = first.id
    commit(next, { focus: isText(first.type) ? { host: isList(first.type) ? `${first.id}:i0` : `${first.id}:html`, at: 'end' } : { select: first.id }, reseed: true })
    setMenu(hasSettings(first.type) && needsSetup(first) ? 'settings' : null)
  }
  const pickFromPalette = (item: PaletteItem) => {
    const made = item.make()
    addBlocks(made, insertIndexFor(made), palette.replace)
    setPalette(p => (phone || p.replace || p.at !== undefined ? { open: false } : { open: true }))
  }
  const openPalette = (at?: number) => setPalette({ open: true, at })

  // --- drag: move a section, or drag a new one in from the palette ---------------------------------
  const dragRef = useRef<{ what: DragWhat; gaps: { index: number; y: number }[]; column: Box; index: number | null; y: number; raf: number } | null>(null)
  const gapsNow = () => {
    const root = rootRef.current
    const blocks = blocksRef.current
    const gaps: { index: number; y: number }[] = []
    if (!root) return gaps
    const at = new Map(blocks.map((b, i) => [b.id, i]))
    const rows: { id: string; index: number; top: number; bottom: number }[] = []
    root.querySelectorAll<HTMLElement>(':scope > [data-bm]').forEach(m => {
      const el = m.nextElementSibling as HTMLElement | null
      const index = at.get(m.dataset.bm || '')
      if (!el || el.hasAttribute('data-bm') || index === undefined) return
      const r = el.getBoundingClientRect()
      if (!r.height) return
      rows.push({ id: m.dataset.bm || '', index, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY })
    })
    rows.forEach((r, k) => gaps.push({ index: r.index, y: k === 0 ? r.top - 10 : (rows[k - 1].bottom + r.top) / 2 }))
    const last = rows[rows.length - 1]
    if (last) {
      const b = blocks[last.index]
      const r = b.type === 'heading' && b.data?.hidden ? unitRange(blocks, b.id) : null
      gaps.push({ index: r ? r[1] : last.index + 1, y: last.bottom + 10 })
    } else gaps.push({ index: blocks.length, y: pageBox(root).top + 10 })
    return gaps
  }
  const startDrag = (what: DragWhat, label: string, x: number, y: number) => {
    const root = rootRef.current
    if (!root) return
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    window.getSelection()?.removeAllRanges()
    setMenu(null)
    setHover(null)
    dragRef.current = { what, gaps: gapsNow(), column: pageBox(root), index: null, y, raf: 0 }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'
    const place = (cx: number, cy: number) => {
      const d = dragRef.current
      if (!d) return
      d.y = cy
      const blocks = blocksRef.current
      const py = cy + window.scrollY
      let best = d.gaps[0]
      for (const g of d.gaps) if (Math.abs(g.y - py) < Math.abs(best.y - py)) best = g
      const moving = d.what.kind === 'move' ? (() => { const r = unitRange(blocks, d.what.id); return r ? blocks.slice(r[0], r[1]) : [] })() : d.what.item.make()
      let index: number | null = best ? clampDrop(blocks, moving, best.index) : null
      let gap = best
      if (index !== null && best && index !== best.index) gap = [...d.gaps].reverse().find(g => g.index <= index!) || d.gaps[0]
      if (index !== null && d.what.kind === 'move') {
        const r = unitRange(blocks, d.what.id)
        if (r && index >= r[0] && index <= r[1]) index = null
      }
      d.index = index
      setDrag({ label, x: cx, y: cy, line: index !== null && gap ? { top: gap.y - 2, left: d.column.left, width: d.column.width, height: 4 } : null })
    }
    let lastX = x
    const tick = () => {
      const d = dragRef.current
      if (!d) return
      // Near the top or bottom of the screen the page scrolls, so a section can travel the whole article.
      const edge = 90
      const top = barBottom()
      const speed = d.y < top + edge ? -Math.ceil((top + edge - d.y) / 6) : d.y > window.innerHeight - edge ? Math.ceil((d.y - (window.innerHeight - edge)) / 6) : 0
      if (speed) { window.scrollBy(0, speed); place(lastX, d.y) }
      d.raf = requestAnimationFrame(tick)
    }
    const move = (ev: PointerEvent) => { lastX = ev.clientX; place(ev.clientX, ev.clientY) }
    const finish = (apply: boolean) => {
      const d = dragRef.current
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('keydown', key)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      if (d) cancelAnimationFrame(d.raf)
      dragRef.current = null
      setDrag(null)
      if (!apply || !d || d.index === null) return
      if (d.what.kind === 'move') { pendingReveal.current = d.what.id; commit(moveUnit(blocksRef.current, d.what.id, d.index), { focus: { select: d.what.id }, reseed: true }) }
      else addBlocks(d.what.item.make(), d.index)
    }
    const up = () => finish(true)
    const cancel = () => finish(false)
    const key = (ev: KeyboardEvent) => { if (ev.key === 'Escape') finish(false) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('keydown', key)
    place(x, y)
    dragRef.current.raf = requestAnimationFrame(tick)
  }
  const startMove = (id: string, e: React.PointerEvent) => {
    const b = blockOf(id)
    if (!b || e.button > 0) return
    e.preventDefault()
    const r = unitRange(blocksRef.current, id)
    const count = r ? r[1] - r[0] : 1
    const words = plainOf(b).trim().replace(/\s+/g, ' ').slice(0, 38)
    startDrag({ kind: 'move', id }, b.type === 'heading' ? `Section: ${words || 'Untitled'}${count > 1 ? ` (${count} parts)` : ''}` : `${labelOf(b)}${words && isText(b.type) ? `: ${words}` : ''}`, e.clientX, e.clientY)
  }

  // --- keys while a card (not text) is picked, and clicking away ----------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null
      if (ae && (ae.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) return
      const k = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && !e.altKey && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if ((e.metaKey || e.ctrlKey) && !e.altKey && k === 'y') { e.preventDefault(); redo(); return }
      const id = selectedRef.current
      const b = blockOf(id)
      if (!id || !b || menuRef.current) return
      if (e.key === 'Escape') { setSelected(null); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        const i = blocksRef.current.findIndex(x => x.id === id)
        addBlocks([newBlock('paragraph')], i + 1)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isText(b.type) && !(propsRef.current.signatureOn && CLOSING_TYPES.includes(b.type))) { e.preventDefault(); removeOne(id) }
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (!t || rootRef.current?.contains(t) || t.closest('[data-blog-editor-ui],[role="dialog"],[data-blog-title]')) return
      setSelected(null)
      setMenu(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.signatureOn])

  // --- the article, drawn by the same components readers get ---------------------------------------
  const body = useMemo(() => (
    <BlogArticleBody
      edit={edit}
      blocks={blocksRef.current}
      agent={props.agent}
      accentColor={accent}
      signatureHubSlug={props.signatureHubSlug}
      signatureTowns={props.signatureTowns}
      signatureMatch={blogSignatureMatch(blog.theme, blog.luxe_metal, blog.accent_color)}
      forms={props.forms}
      formHref={props.formHref}
      neighborhoodLinks={props.neighborhoodLinks}
    />
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [version, outside.current, edit, accent, props.agent, props.signatureHubSlug, props.signatureTowns, props.forms, props.formHref, props.neighborhoodLinks, blog.theme, blog.luxe_metal, blog.accent_color])

  const themedEdit = useMemo(() => ({
    title: (styled: React.ReactNode) => <EditableTitle value={blog.title || ''} styled={styled} onChange={title => propsRef.current.onMeta({ title })} onEnter={() => { const first = rootRef.current?.querySelector<HTMLElement>('[data-host]'); if (first) setCaret(first, 'start') }} />,
    subtitle: <EditableLine value={blog.subtitle || ''} placeholder="Add a subtitle (optional)" label="Subtitle" onChange={subtitle => propsRef.current.onMeta({ subtitle })} />,
    cover: (has: boolean) => (
      <button type="button" data-blog-editor-ui onClick={() => propsRef.current.onOpenLook()}
        className={has
          ? 'inline-flex min-h-[40px] items-center gap-2 rounded-full bg-black/65 px-4 text-xs font-black text-white shadow-lg transition hover:bg-black/80 active:scale-95'
          : 'mb-2 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-dashed border-[#C9A24D] bg-[#111827] px-5 text-xs font-black text-[#e8c97a] shadow-lg transition hover:-translate-y-0.5 active:scale-95'}>
        <ImagePlus className="h-4 w-4" /> {has ? 'Change cover' : 'Add a cover photo'}
      </button>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [blog.title, blog.subtitle])

  const selectedBlock = blockOf(selected)
  const where = selectedBlock ? 'It goes under the section you picked.' : 'It goes at the end of the article.'
  const [panelTop, setPanelTop] = useState(0)
  useLayoutEffect(() => { if (palette.open) setPanelTop(Math.max(0, barBottom())) }, [palette.open])
  useEffect(() => {
    if (!palette.open || phone) return
    const on = () => setPanelTop(Math.max(0, barBottom()))
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [palette.open, phone])

  return (
    <div data-blog-canvas className="transition-[padding] duration-300" style={{ paddingLeft: palette.open && !phone ? 340 : 0, paddingRight: menu === 'settings' && selectedBlock && !phone ? 380 : 0 }}>
      <style>{EDIT_CSS}</style>
      <BlogThemedArticle
        edit={themedEdit}
        mode={mode}
        signatureOn={props.signatureOn && !!props.signatureHubSlug}
        metal={blog.luxe_metal}
        accent={blog.accent_color}
        theme={blog.theme}
        title={blog.title || 'Untitled Article'}
        subtitle={blog.subtitle}
        category={blog.category}
        coverUrl={blog.cover_image_url}
        publishedAt={blog.published_at || new Date().toISOString()}
        agent={{ name: props.agent.name, title: props.agent.title, brokerage: props.agent.brokerage, photoUrl: props.agent.photoUrl }}
      >
        {body}
      </BlogThemedArticle>

      <TextToolbar root={rootRef} />

      {typeof document !== 'undefined' && createPortal(
        <SectionChrome
          elOf={elOf}
          version={version}
          selected={drag ? null : selectedBlock}
          quiet={quiet && !menu}
          hover={drag || !hover || hover === selected ? null : blockOf(hover)}
          blocks={blocksRef.current}
          shown={info().shown}
          phone={phone}
          menu={menu}
          setMenu={setMenu}
          signatureOn={props.signatureOn}
          refineBusy={props.refineBusy}
          refineEstimate={props.refineEstimate}
          keepHover={keepHover}
          fadeHover={fadeHover}
          onStartMove={startMove}
          onStep={step}
          onDuplicate={duplicate}
          onRemove={removeOne}
          onRemoveSection={removeSection}
          onTurnInto={turnInto}
          onStyle={styleOf}
          onHide={id => setHidden(id, true)}
          onAddBelow={id => { const blocks = blocksRef.current; const i = blocks.findIndex(b => b.id === id); const b = blocks[i]; const r = b && b.type === 'heading' && b.data?.hidden ? unitRange(blocks, id) : null; setSelected(id); openPalette(r ? r[1] : i + 1) }}
          onUpdate={(id, updater) => update(id, updater, `settings:${id}`)}
          onRefine={id => { setMenu(null); props.onRefine(id) }}
          onOpenPublish={props.onOpenPublish}
        />,
        document.body,
      )}

      {drag && typeof document !== 'undefined' && createPortal(
        <>
          {drag.line && <div className="pointer-events-none absolute z-[29] rounded-full bg-[#C9A24D] shadow-[0_0_0_4px_rgba(201,162,77,.22),0_0_24px_rgba(201,162,77,.6)]" style={{ top: drag.line.top, left: drag.line.left, width: drag.line.width, height: drag.line.height }} />}
          <div className="pointer-events-none fixed z-[10010] inline-flex max-w-[70vw] items-center gap-2 rounded-xl border border-[#C9A24D] bg-[#111827] px-3 py-2 text-xs font-black text-white shadow-2xl" style={{ top: drag.y + 14, left: Math.min(drag.x + 14, window.innerWidth - 260) }}>
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-[#e8c97a]" /> <span className="truncate">{drag.label}</span>
          </div>
        </>,
        document.body,
      )}

      <BlockPalette
        open={palette.open}
        phone={phone}
        top={panelTop}
        blocks={blocksRef.current}
        accent={accent}
        agent={props.agent}
        where={palette.replace ? 'It takes the place of the empty line.' : palette.at !== undefined ? 'It goes right where you tapped +.' : where}
        onPick={pickFromPalette}
        onDragStart={(item, e) => startDrag({ kind: 'new', item }, item.label, e.clientX, e.clientY)}
        onClose={() => setPalette({ open: false })}
      />

      {/* The dock: undo, add a section, and the reader's Light / Dark. */}
      <div data-blog-editor-ui className="pointer-events-none fixed inset-x-0 bottom-0 z-[28] flex flex-col items-start gap-2 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:px-3">
        <AnimatePresence>
          {snack && (
            <motion.div key={snack.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} className="pointer-events-auto flex max-w-full items-center gap-3 rounded-2xl bg-[#111827] px-4 py-2.5 text-xs font-bold text-white shadow-2xl">
              <span className="min-w-0">{snack.text}</span>
              {snack.undo && <button type="button" onClick={() => { undo(); setSnack(null) }} className="shrink-0 rounded-lg bg-[#C9A24D] px-2.5 py-1 font-black text-[#111827]">Undo</button>}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-black/10 bg-white p-1.5 shadow-[0_18px_44px_-18px_rgba(0,0,0,.55)] dark:border-white/15 dark:bg-[#17171a]">
          <button type="button" onClick={undo} disabled={!past.current.length} aria-label="Undo" title="Undo" className="grid h-10 w-10 place-items-center rounded-xl text-[#111827] transition hover:bg-black/5 disabled:opacity-30 dark:text-white dark:hover:bg-white/10"><Undo2 className="h-4 w-4" /></button>
          <button type="button" onClick={redo} disabled={!future.current.length} aria-label="Redo" title="Redo" className="grid h-10 w-10 place-items-center rounded-xl text-[#111827] transition hover:bg-black/5 disabled:opacity-30 dark:text-white dark:hover:bg-white/10"><Redo2 className="h-4 w-4" /></button>
          <button type="button" onClick={() => (palette.open ? setPalette({ open: false }) : openPalette())} data-testid="blog-add-section"
            className="lx-shine relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-xl bg-[#111827] px-4 text-sm font-black text-white transition hover:-translate-y-0.5 active:scale-95 dark:bg-gradient-to-r dark:from-[#C9A24D] dark:to-[#e8c97a] dark:text-[#111827]">
            <Plus className="h-4 w-4" /> Add a section
          </button>
          <button type="button" onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} aria-label={mode === 'dark' ? 'See it in light mode' : 'See it in dark mode'} title="How readers see it: light or dark"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-[11px] font-black uppercase tracking-widest text-[#111827] transition hover:bg-black/5 dark:text-white dark:hover:bg-white/10">
            {mode === 'dark' ? <Moon className="h-4 w-4 text-[#e8c97a]" /> : <Sun className="h-4 w-4 text-[#C9A24D]" />} <span className="hidden sm:inline">{mode === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// What's drawn over the page: the outline and toolbar of the picked section, the handle on the one
// under the mouse. Its own component so scrolling and typing only redraw this, never the article.
// ---------------------------------------------------------------------------

function SectionChrome(p: {
  elOf: (id: string | null) => HTMLElement | null
  version: number
  selected: BlogBlock | null
  /** Typing: only the thin outline stays. */
  quiet: boolean
  hover: BlogBlock | null
  blocks: BlogBlock[]
  shown: Set<string>
  phone: boolean
  menu: Menu
  setMenu: (m: Menu) => void
  signatureOn: boolean
  refineBusy: string | null
  refineEstimate?: AiShare | null
  keepHover: () => void
  fadeHover: () => void
  onStartMove: (id: string, e: React.PointerEvent) => void
  onStep: (id: string, dir: -1 | 1) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
  onRemoveSection: (id: string) => void
  onTurnInto: (id: string, type: BlockType) => void
  onStyle: (id: string, patch: Record<string, any>) => void
  onHide: (id: string) => void
  onAddBelow: (id: string) => void
  onUpdate: (id: string, updater: (b: BlogBlock) => BlogBlock) => void
  onRefine: (id: string) => void
  onOpenPublish: () => void
}) {
  const { selected: sel, hover: hov, phone, menu, setMenu } = p
  const [boxes, setBoxes] = useState<{ sel: Box | null; hov: Box | null; scroll: number; bar: number; vw: number }>({ sel: null, hov: null, scroll: 0, bar: 0, vw: 1200 })
  const [, tick] = useReducer((n: number) => n + 1, 0)
  // Something is picked or under the mouse: keep its outline lined up while photos load or the page reflows.
  const liveRef = useRef(false)
  liveRef.current = !!(sel || hov)

  // Measure after every draw, and again whenever the page moves under the chrome.
  useLayoutEffect(() => {
    const selEl = p.elOf(sel?.id || null)
    const hovEl = p.elOf(hov?.id || null)
    const next = { sel: selEl ? pageBox(selEl) : null, hov: hovEl ? pageBox(hovEl) : null, scroll: window.scrollY, bar: barBottom(), vw: document.documentElement.clientWidth }
    if (!sameBox(next.sel, boxes.sel) || !sameBox(next.hov, boxes.hov) || next.scroll !== boxes.scroll || next.bar !== boxes.bar || next.vw !== boxes.vw) setBoxes(next)
  })
  useEffect(() => {
    let raf = 0
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick) }
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    document.addEventListener('input', on, true)
    document.addEventListener('load', on, true)
    const slow = setInterval(() => { if (liveRef.current) on() }, 900)
    return () => { cancelAnimationFrame(raf); clearInterval(slow); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); document.removeEventListener('input', on, true); document.removeEventListener('load', on, true) }
  }, [])

  const btn = 'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-25 sm:h-8 sm:w-8'
  const hold = (e: React.MouseEvent) => e.preventDefault()   // keep the caret where it is while a toolbar button is pressed

  let selUi: React.ReactNode = null
  if (sel && boxes.sel) {
    const b = sel
    const box = boxes.sel
    const text = isText(b.type)
    const heading = b.type === 'heading'
    const signature = p.signatureOn && CLOSING_TYPES.includes(b.type)
    const range = unitRange(p.blocks, b.id)
    const parts = range ? range[1] - range[0] : 1
    const canCopy = !SINGLE_TYPES.includes(b.type) && !(heading && range && p.blocks.slice(range[0], range[1]).some(x => SINGLE_TYPES.includes(x.type)))
    const unseen = !p.shown.has(b.id)
    const top = Math.max(box.top - 48, Math.min(boxes.scroll + boxes.bar + 8, box.top + box.height - 44))
    const left = phone ? 8 : Math.max(8, Math.min(box.left - 8, boxes.vw - 420))
    const title = signature ? 'Your signature card' : heading ? 'Section' : labelOf(b)

    const menuBody = menu === 'style' ? (
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Turn into</p>
          <div className="grid grid-cols-2 gap-1.5">
            {TURN_INTO.map(t => (
              <button key={t.type} type="button" onMouseDown={hold} onClick={() => p.onTurnInto(b.id, t.type)}
                className={`flex min-h-[40px] items-center justify-between gap-2 rounded-xl border px-3 text-left text-xs font-black transition sm:min-h-[36px] ${b.type === t.type ? 'border-[#C9A24D] bg-[#C9A24D]/12 text-[#111827] dark:text-white' : 'border-gray-200 text-gray-600 hover:border-[#C9A24D] dark:border-gray-700 dark:text-gray-300'}`}>
                {t.label} {b.type === t.type && <Check className="h-3.5 w-3.5 text-[#C9A24D]" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
        {isRich(b.type) && (
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Line up</p>
              <div className="inline-flex gap-1 rounded-xl border border-gray-200 p-1 dark:border-gray-700">
                {(['left', 'center'] as const).map(a => {
                  const on = (b.data?.align === 'center' ? 'center' : 'left') === a
                  return <button key={a} type="button" onMouseDown={hold} onClick={() => p.onStyle(b.id, { align: a })} aria-label={a === 'left' ? 'Left' : 'Centered'} className={`grid h-9 w-10 place-items-center rounded-lg ${on ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500'}`}>{a === 'left' ? <AlignLeft className="h-4 w-4" /> : <AlignCenter className="h-4 w-4" />}</button>
                })}
              </div>
            </div>
            {b.type === 'paragraph' && (
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400">Text size</p>
                <div className="inline-flex gap-1 rounded-xl border border-gray-200 p-1 dark:border-gray-700">
                  {([['sm', 'Small'], ['base', 'Normal'], ['lg', 'Large']] as const).map(([size, name]) => {
                    const on = (b.data?.size || 'base') === size
                    return <button key={size} type="button" onMouseDown={hold} onClick={() => p.onStyle(b.id, { size })} className={`h-9 rounded-lg px-3 text-xs font-black ${on ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-500'}`}>{name}</button>
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    ) : menu === 'delete' ? (
      <div className="space-y-1.5">
        <button type="button" onClick={() => p.onRemoveSection(b.id)} className="flex min-h-[44px] w-full items-center gap-2 rounded-xl bg-red-500 px-3.5 text-left text-sm font-black text-white hover:bg-red-600"><Trash2 className="h-4 w-4" /> Delete the whole section{parts > 1 ? ` (${parts} parts)` : ''}</button>
        <button type="button" onClick={() => p.onRemove(b.id)} className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-left text-sm font-black text-[#111827] hover:border-red-300 dark:border-gray-700 dark:text-white">Delete just this heading</button>
        <button type="button" onClick={() => p.onHide(b.id)} className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-gray-200 px-3.5 text-left text-sm font-black text-[#111827] hover:border-[#C9A24D] dark:border-gray-700 dark:text-white"><EyeOff className="h-4 w-4" /> Hide it from readers instead</button>
        <p className="px-1 pt-1 text-[11px] font-semibold text-gray-400">You can undo any of these.</p>
      </div>
    ) : menu === 'refine' ? (
      <div className="max-w-[300px]">
        <p className="flex items-center gap-1 pb-1 text-[10px] font-black uppercase tracking-widest text-[#8b7355] dark:text-[#d7b974]"><Sparkles className="h-3 w-3" /> Refine</p>
        <p className="text-[12px] font-semibold leading-snug text-gray-600 dark:text-gray-300">Fixes the spelling, grammar and wording of {heading ? 'what you wrote in this section' : 'what you wrote here'}. Your facts and numbers stay the same, and nothing is added. You see both versions and pick one.</p>
        <button type="button" data-testid="blog-refine-go" disabled={!!p.refineBusy} onClick={() => p.onRefine(b.id)} className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-4 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:opacity-40 dark:bg-white dark:text-[#111827] sm:min-h-[38px]"><Sparkles className="h-4 w-4" /> Fix my writing</button>
        <p data-testid="blog-refine-cost" className="pt-2 text-[10px] font-black text-[#8b7355] dark:text-[#d7b974]">{aiUsesLine(p.refineEstimate)}</p>
      </div>
    ) : menu === 'settings' ? (
      <div>
        <BlockSettings key={b.id} block={b} onUpdate={updater => p.onUpdate(b.id, updater)} signatureOn={p.signatureOn} onOpenPublish={p.onOpenPublish} />
        <div className="mt-4 flex justify-end"><button type="button" onClick={() => setMenu(null)} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#111827] px-4 text-xs font-black text-white dark:bg-white dark:text-[#111827]"><Check className="h-3.5 w-3.5" strokeWidth={3} /> Done</button></div>
      </div>
    ) : null
    const menuTitle = menu === 'style' ? 'Style' : menu === 'delete' ? 'Delete' : menu === 'refine' ? 'Refine with AI' : title

    selUi = (
      <>
        <div className={`pointer-events-none absolute z-[24] rounded-xl ${text ? 'border border-[#C9A24D]/60' : 'border-2 border-[#C9A24D] shadow-[0_0_0_4px_rgba(201,162,77,.16)]'}`} style={{ top: box.top - 6, left: box.left - 8, width: box.width + 16, height: box.height + 12 }} />
        {!p.quiet && <div data-blog-editor-ui data-testid="blog-section-toolbar" className="absolute z-[26] flex max-w-[calc(100vw-16px)] items-center gap-0.5 overflow-x-auto rounded-xl border border-black/40 bg-[#111827] p-1 shadow-2xl [scrollbar-width:none]" style={{ top, left }}>
          <button type="button" aria-label="Drag to move" title={heading ? 'Drag to move the whole section' : 'Drag to move'} onPointerDown={e => p.onStartMove(b.id, e)} className={`${btn} cursor-grab touch-none active:cursor-grabbing`}><GripVertical className="h-4 w-4" /></button>
          {text ? (
            <button type="button" onMouseDown={hold} onClick={() => setMenu(menu === 'style' ? null : 'style')} aria-label="Style" title="Change the style" className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-black text-white/85 transition hover:bg-white/10 sm:h-8">
              <Type className="h-3.5 w-3.5 text-[#e8c97a]" /> <span className={`max-w-[92px] truncate ${heading ? 'hidden sm:inline' : ''}`}>{labelOf(b)}</span> <ChevronDown className="h-3 w-3 opacity-60" />
            </button>
          ) : (
            <span className="inline-flex h-8 shrink-0 items-center px-2 text-[11px] font-black text-white/85"><span className="max-w-[130px] truncate">{title}</span></span>
          )}
          <span className="mx-0.5 h-4 w-px shrink-0 bg-white/15" />
          <button type="button" onMouseDown={hold} onClick={() => p.onStep(b.id, -1)} disabled={!canStep(p.blocks, b.id, -1)} aria-label="Move up" title="Move up" className={btn}><ArrowUp className="h-4 w-4" /></button>
          <button type="button" onMouseDown={hold} onClick={() => p.onStep(b.id, 1)} disabled={!canStep(p.blocks, b.id, 1)} aria-label="Move down" title="Move down" className={btn}><ArrowDown className="h-4 w-4" /></button>
          <button type="button" onClick={() => p.onAddBelow(b.id)} aria-label="Add a section below" title="Add a section below" className={btn}><Plus className="h-4 w-4" /></button>
          {canCopy && <button type="button" onClick={() => p.onDuplicate(b.id)} aria-label="Duplicate" title={heading ? 'Duplicate the section' : 'Duplicate'} className={btn}><Copy className="h-4 w-4" /></button>}
          {hasSettings(b.type) && <button type="button" onClick={() => setMenu(menu === 'settings' ? null : 'settings')} aria-label="Settings" title="Change what it shows" className={`${btn} ${menu === 'settings' ? 'bg-white/15 text-white' : ''}`}><Pencil className="h-4 w-4" /></button>}
          {canRefine(p.blocks, b.id) && (
            <button type="button" onClick={() => setMenu(menu === 'refine' ? null : 'refine')} disabled={p.refineBusy === b.id} aria-label="Refine with AI" title={heading ? 'Fix the writing in this section' : 'Fix the writing here'} className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-black text-[#e8c97a] transition hover:bg-white/10 sm:h-8">
              {p.refineBusy === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} <span className="hidden sm:inline">{p.refineBusy === b.id ? 'Refining...' : 'Refine'}</span>
            </button>
          )}
          {heading && <button type="button" onClick={() => p.onHide(b.id)} aria-label="Hide section from readers" title="Hide this section from readers (you can show it again)" className={btn}><EyeOff className="h-4 w-4" /></button>}
          {!signature && <button type="button" onClick={() => (heading && parts > 1 ? setMenu(menu === 'delete' ? null : 'delete') : p.onRemove(b.id))} aria-label="Delete" title="Delete" className={`${btn} hover:!bg-red-500/90`}><Trash2 className="h-4 w-4" /></button>}
        </div>}
        {unseen && !menu && !p.quiet && (
          <div className="pointer-events-none absolute z-[25] rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow" style={{ top: box.top + box.height + 10, left: box.left - 8 }}>
            {heading ? 'Readers see this once there are words under it' : 'Empty - readers won’t see this yet'}
          </div>
        )}
        {menuBody && (phone ? (
          <PopupSheet open onClose={() => setMenu(null)} title={menuTitle}>{menuBody}</PopupSheet>
        ) : menu === 'settings' ? (
          <motion.aside data-blog-editor-ui data-testid="blog-section-settings" initial={{ x: 380, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            className="fixed bottom-0 right-0 z-[28] flex w-[380px] flex-col border-l border-gray-200 bg-white shadow-[-20px_0_50px_-30px_rgba(0,0,0,.45)] dark:border-white/10 dark:bg-[#121214]" style={{ top: Math.max(0, boxes.bar) }}>
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-white/10">
              <p className="min-w-0 truncate font-serif text-lg font-black text-[#111827] dark:text-white">{menuTitle}</p>
              <button type="button" onClick={() => setMenu(null)} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-24">{menuBody}</div>
          </motion.aside>
        ) : (
          <div data-blog-editor-ui className="absolute z-[29] max-h-[70vh] w-[320px] overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-3.5 shadow-2xl dark:border-gray-700 dark:bg-[#1A1A1C]" style={{ top: top + 46, left }}>
            {menuBody}
          </div>
        ))}
      </>
    )
  }

  const hovUi = hov && boxes.hov && !phone ? (
    <>
      <div className="pointer-events-none absolute z-[23] rounded-xl border border-dashed border-[#C9A24D]/55" style={{ top: boxes.hov.top - 6, left: boxes.hov.left - 8, width: boxes.hov.width + 16, height: boxes.hov.height + 12 }} />
      <button type="button" data-blog-editor-ui aria-label="Drag to move" title={hov.type === 'heading' ? 'Drag to move the whole section' : 'Drag to move'} onMouseEnter={p.keepHover} onMouseLeave={p.fadeHover} onPointerDown={e => p.onStartMove(hov.id, e)}
        className="absolute z-[25] grid h-8 w-7 cursor-grab touch-none place-items-center rounded-lg border border-[#C9A24D]/50 bg-white text-[#8b7355] shadow-md transition hover:bg-[#C9A24D] hover:text-[#111827] active:cursor-grabbing dark:bg-[#1A1A1C] dark:text-[#e8c97a]"
        style={{ top: boxes.hov.top - 2, left: boxes.hov.left - 40 }}>
        <GripVertical className="h-4 w-4" />
      </button>
    </>
  ) : null
  const plusFor = !phone && !p.quiet ? (hov && boxes.hov ? { id: hov.id, box: boxes.hov } : sel && boxes.sel && !menu ? { id: sel.id, box: boxes.sel } : null) : null

  return (
    <>
      {hovUi}
      {selUi}
      {plusFor && (
        <button type="button" data-blog-editor-ui aria-label="Add a section here" title="Add a section here" onMouseEnter={p.keepHover} onMouseLeave={p.fadeHover} onClick={() => p.onAddBelow(plusFor.id)}
          className="absolute z-[25] grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full border border-[#C9A24D]/60 bg-white text-[#8b7355] shadow-md transition hover:scale-110 hover:bg-[#C9A24D] hover:text-[#111827] dark:bg-[#1A1A1C] dark:text-[#e8c97a]"
          style={{ top: plusFor.box.top + plusFor.box.height + 3, left: plusFor.box.left + plusFor.box.width / 2 }}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  )
}
