'use client'

// Editor for one automatic follow-up situation's suggested message. The personal details the
// backend fills in per lead ({first_name}, {address}, {showcase}...) show as coloured pills inside
// the text. Pills can be dragged to reorder, dragged (or tapped) in from the palette, and removed
// with their ×. The message is stored as plain text with {tokens}; the backend renders it
// (tasks_service.render_template) and drops the Showcase pitch where the {showcase} pill sits.
// Situations that build the guest a Showcase have a SECOND editable part: the pitch itself
// ({home_count}, {best_home}, {why_now}, {showcase_link} - tasks_service.render_pitch).
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, GripVertical, Home, Link2, Loader2, MapPin, MessageSquareText, PenLine, RotateCcw, Sparkles, User, UserRound } from 'lucide-react'
import type { MessageToken } from '@/types'
import CalendarAlertPreview from './CalendarAlertPreview'

const MAX = 1200
const TOKEN_MIME = 'application/x-ohp-token'
// A part the agent fills in by hand before sending, e.g. "[ADD DATE & TIME]" (the showing they booked).
const FILL_IN_RE = /(\[[A-Z0-9 &]+\])/

const KIND_STYLE: Record<string, { chip: string; icon: typeof User }> = {
  person: { chip: 'bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-500/15 dark:text-sky-200 dark:ring-sky-400/40', icon: User },
  property: { chip: 'bg-amber-100 text-amber-900 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/40', icon: MapPin },
  link: { chip: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-400/40', icon: Link2 },
  you: { chip: 'bg-violet-100 text-violet-800 ring-violet-300 dark:bg-violet-500/15 dark:text-violet-200 dark:ring-violet-400/40', icon: UserRound },
}

// ---------------------------------------------------------------- DOM <-> template string
function chipEl(token: MessageToken): HTMLSpanElement {
  const style = KIND_STYLE[token.kind] || KIND_STYLE.person
  const el = document.createElement('span')
  el.contentEditable = 'false'
  el.draggable = true
  el.dataset.token = token.key
  el.className = `ohp-chip group/chip mx-0.5 inline-flex cursor-grab select-none items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 align-baseline text-[12px] font-black ring-1 transition active:cursor-grabbing ${style.chip}`
  el.innerHTML =
    `<span aria-hidden="true" style="opacity:.55">⋮⋮</span>${escapeHtml(token.label)}` +
    `<button type="button" data-remove="1" aria-label="Remove ${escapeHtml(token.label)}" class="ml-0.5 rounded-full px-1 text-[11px] leading-none opacity-50 hover:bg-black/10 hover:opacity-100">×</button>`
  return el
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function fill(editor: HTMLElement, template: string, tokens: Record<string, MessageToken>) {
  editor.innerHTML = ''
  const re = /\{(\w+)\}/g
  let last = 0
  let m: RegExpExecArray | null
  const pushText = (t: string) => {
    // newlines become <br> so the caret and serialisation behave the same in every browser
    t.split('\n').forEach((part, i) => {
      if (i) editor.appendChild(document.createElement('br'))
      if (part) editor.appendChild(document.createTextNode(part))
    })
  }
  while ((m = re.exec(template))) {
    pushText(template.slice(last, m.index))
    const tok = tokens[m[1]]
    if (tok) editor.appendChild(chipEl(tok))
    else pushText(m[0])
    last = m.index + m[0].length
  }
  pushText(template.slice(last))
}

function serialize(root: Node): string {
  let out = ''
  root.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) out += (node.nodeValue || '').replace(/ /g, ' ')
    else if (node instanceof HTMLElement) {
      if (node.dataset.token) out += `{${node.dataset.token}}`
      else if (node.tagName === 'BR') out += '\n'
      else if (node.tagName === 'DIV' || node.tagName === 'P') out += (out && !out.endsWith('\n') ? '\n' : '') + serialize(node)
      else out += serialize(node)
    }
  })
  return out
}

function rangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y)
  const pos = doc.caretPositionFromPoint?.(x, y)
  if (!pos) return null
  const r = document.createRange()
  r.setStart(pos.offsetNode, pos.offset)
  r.collapse(true)
  return r
}

// ---------------------------------------------------------------- one pill-editable field
type FieldHandle = { load: (tpl: string) => void }

const TokenField = forwardRef<FieldHandle, {
  initial: string
  tokens: MessageToken[]
  label: string
  minHeight: number
  onChange: (v: string) => void
}>(function TokenField({ initial, tokens, label, minHeight, onChange }, ref) {
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const dragging = useRef<HTMLElement | null>(null)
  const byKey = useMemo(() => Object.fromEntries(tokens.map(t => [t.key, t])), [tokens])
  const [dropHint, setDropHint] = useState(false)

  const sync = useCallback(() => {
    if (editorRef.current) onChange(serialize(editorRef.current).slice(0, MAX))
  }, [onChange])

  const load = useCallback((tpl: string) => {
    if (!editorRef.current) return
    fill(editorRef.current, tpl, byKey)
    onChange(tpl)
  }, [byKey, onChange])

  useImperativeHandle(ref, () => ({ load }), [load])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(initial) }, [initial])

  const remember = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount && editorRef.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange()
  }

  const insertChipAt = (range: Range | null, key: string) => {
    const editor = editorRef.current
    const tok = byKey[key]
    if (!editor || !tok) return
    const chip = chipEl(tok)
    // Dropped onto another pill? Land right after it, never inside it.
    const inside = range ? (range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer as HTMLElement)?.closest?.('[data-token]') : null
    if (range && inside && editor.contains(inside)) {
      range.setStartAfter(inside)
      range.collapse(true)
    }
    if (range && editor.contains(range.startContainer)) {
      range.insertNode(chip)
    } else {
      editor.appendChild(chip)
    }
    // a space after the chip so typing continues naturally; caret goes after it
    const space = document.createTextNode(' ')
    chip.after(space)
    const r = document.createRange()
    r.setStartAfter(space)
    r.collapse(true)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
    savedRange.current = r.cloneRange()
    editor.normalize()
    sync()
  }

  // ---- editor events
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      document.execCommand('insertLineBreak')
      sync()
    }
  }
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
    sync()
  }
  const onClick = (e: React.MouseEvent) => {
    const btn = (e.target as HTMLElement).closest('[data-remove]')
    if (btn) {
      btn.closest('[data-token]')?.remove()
      editorRef.current?.normalize()
      sync()
    }
  }
  const onDragStart = (e: React.DragEvent) => {
    const chip = (e.target as HTMLElement).closest?.('[data-token]') as HTMLElement | null
    if (!chip) return
    dragging.current = chip
    e.dataTransfer.setData(TOKEN_MIME, chip.dataset.token || '')
    e.dataTransfer.setData('text/plain', '')
    e.dataTransfer.effectAllowed = 'copyMove'
    requestAnimationFrame(() => chip.classList.add('opacity-30'))
  }
  const onDragEnd = () => {
    dragging.current?.classList.remove('opacity-30')
    dragging.current = null
    setDropHint(false)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(TOKEN_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = dragging.current ? 'move' : 'copy'
    setDropHint(true)
  }
  const onDrop = (e: React.DragEvent) => {
    const key = e.dataTransfer.getData(TOKEN_MIME)
    if (!key) return
    e.preventDefault()
    setDropHint(false)
    if (!byKey[key]) return // a pill that doesn't belong in this part
    const range = rangeFromPoint(e.clientX, e.clientY)
    const moving = dragging.current
    if (moving && range && moving.contains(range.startContainer)) return onDragEnd() // dropped on itself
    moving?.remove()
    dragging.current = null
    insertChipAt(range, key)
  }

  return (
    <>
      {/* palette */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[10px] font-black uppercase tracking-wide text-gray-400">Drag or tap to add</span>
        {tokens.map(t => {
          const st = KIND_STYLE[t.kind] || KIND_STYLE.person
          return (
            // A plain <button>, not motion.button: framer-motion claims onDragStart for its own
            // gesture system, which silently killed the native HTML5 drag from the palette.
            <button
              key={t.key}
              type="button"
              draggable
              onDragStart={e => {
                e.dataTransfer.setData(TOKEN_MIME, t.key)
                e.dataTransfer.setData('text/plain', '')
                e.dataTransfer.effectAllowed = 'copy'
              }}
              // No preventDefault on mousedown here - that also blocks the drag from starting.
              // The editor saves its caret on blur, so a tap still inserts where you were.
              onClick={() => { editorRef.current?.focus(); insertChipAt(savedRange.current, t.key) }}
              className={`inline-flex cursor-grab items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ring-1 transition duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-95 active:cursor-grabbing ${st.chip}`}
            >
              <GripVertical className="h-3 w-3 opacity-50" />
              <st.icon className="h-3 w-3" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* the editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        onInput={sync}
        onKeyDown={onKeyDown}
        onKeyUp={remember}
        onMouseUp={remember}
        onBlur={remember}
        onPaste={onPaste}
        onClick={onClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={() => setDropHint(false)}
        onDrop={onDrop}
        style={{ minHeight }}
        className={`mt-2.5 whitespace-pre-wrap break-words rounded-xl border bg-white px-3 py-2.5 sm:px-3.5 sm:py-3 text-[14px] leading-[1.9] text-[#111827] outline-none transition focus:border-[#C9A24D] focus:ring-4 focus:ring-[#C9A24D]/15 dark:bg-[#0f0f11] dark:text-white ${
          dropHint ? 'border-[#C9A24D] ring-4 ring-[#C9A24D]/20' : 'border-gray-200 dark:border-gray-700'
        }`}
      />
    </>
  )
})

// ---------------------------------------------------------------- preview
type Piece = { text: string; kind?: string; link?: boolean }

function fillPreview(template: string, tokens: Record<string, MessageToken>): Piece[] {
  const parts: Piece[] = []
  const re = /\{(\w+)\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) {
    if (m.index > last) parts.push({ text: template.slice(last, m.index) })
    const tok = tokens[m[1]]
    if (!tok) parts.push({ text: m[0] })
    else if (tok.key === 'showcase_link') parts.push({ text: '…/showcase/jane', kind: tok.kind, link: true })
    else parts.push({ text: tok.sample || tok.label, kind: tok.kind })
    last = m.index + m[0].length
  }
  if (last < template.length) parts.push({ text: template.slice(last) })
  return parts
}

function Section({ step, icon: Icon, title, hint, custom, children }: {
  step: number; icon: typeof User; title: string; hint: string; custom?: boolean; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white/70 p-2.5 dark:border-white/10 sm:p-3.5 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#C9A24D] to-[#8b7355] text-[10px] font-black text-white shadow-sm">{step}</span>
        <Icon className="h-3.5 w-3.5 text-[#C9A24D]" />
        <p className="text-[13px] font-black text-[#111827] dark:text-white">{title}</p>
        {custom && <span className="rounded-full bg-[#C9A24D]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#8b7355] dark:text-[#d7b974]">Customized</span>}
      </div>
      <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">{hint}</p>
      {children}
    </div>
  )
}

export default function MessageTemplateEditor({
  template, defaultTemplate, tokens, isCustom,
  pitch, defaultPitch, pitchTokens, pitchStyle, isCustomPitch,
  saving, onSave, onClose, footer, header, signature, ruleKey, seller,
}: {
  template: string
  defaultTemplate: string
  tokens: MessageToken[]
  isCustom: boolean
  pitch?: string
  defaultPitch?: string
  pitchTokens?: MessageToken[]
  pitchStyle?: 'reminder' | 'intro' | null
  isCustomPitch?: boolean
  saving: boolean
  onSave: (next: { template: string; pitch?: string }) => Promise<void> | void
  onClose: () => void
  /** Rendered under the editor, inside the same open/close animation. */
  footer?: React.ReactNode
  /** Rendered above the editor, inside the same animation (e.g. the Buyers / Sellers switch). */
  header?: React.ReactNode
  /** "Thanks,\nName | Brokerage" - added under every message by the backend; shown read-only. */
  signature?: string
  /** With these, the preview can also show the whole calendar alert (backend-rendered). */
  ruleKey?: string
  seller?: boolean
}) {
  const [previewTab, setPreviewTab] = useState<'text' | 'calendar'>('text')
  const hasPitch = !!pitchStyle && !!pitchTokens?.length
  const msgRef = useRef<FieldHandle>(null)
  const pitchRef = useRef<FieldHandle>(null)
  const [value, setValue] = useState(template)
  const [pitchValue, setPitchValue] = useState(pitch || '')
  const byKey = useMemo(() => Object.fromEntries(tokens.map(t => [t.key, t])), [tokens])
  const pitchByKey = useMemo(() => Object.fromEntries((pitchTokens || []).map(t => [t.key, t])), [pitchTokens])

  const changed = value.trim() !== template.trim() || (hasPitch && pitchValue.trim() !== (pitch || '').trim())
  const atDefault = value.trim() === defaultTemplate.trim() && (!hasPitch || pitchValue.trim() === (defaultPitch || '').trim())
  const pitchPlaced = value.includes('{showcase}')
  const pitchHasLink = pitchValue.includes('{showcase_link}')

  // Same assembly as the backend (tasks_service.full_message): the pitch becomes its own paragraph
  // wherever the Showcase pill sits, then extra blank lines collapse.
  const pitchText = pitchHasLink ? pitchValue.trim() : `${pitchValue.trim()} {showcase_link}`
  const assembled = value
    .replace('{showcase}', hasPitch ? `\n\n${pitchText}\n\n` : '')
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const preview = fillPreview(assembled, { ...byKey, ...pitchByKey })

  const reset = () => {
    msgRef.current?.load(defaultTemplate)
    if (hasPitch) pitchRef.current?.load(defaultPitch || '')
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      {header}
      <div className="-mx-2 mt-3 grid gap-4 rounded-2xl border border-[#C9A24D]/30 bg-gradient-to-br from-[#fbf7ee] to-white p-3 shadow-inner sm:mx-0 sm:p-4 dark:from-[#1c1a14] dark:to-[#151517] lg:grid-cols-[1fr_300px]">
        {/* Editor side */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#C9A24D]" />
            <p className="text-sm font-black text-[#111827] dark:text-white">Personalize this message</p>
          </div>
          <p className="mt-0.5 hidden text-[11px] font-medium text-gray-500 dark:text-gray-400 sm:block">
            Type anything. The coloured pills fill in for each lead - drag them to move them, drag or tap one to add it, and × to remove it.
          </p>

          <div className="mt-3 space-y-3">
            <Section step={1} icon={MessageSquareText} title="Your message" custom={isCustom}
              hint={hasPitch ? 'The part you write. The green Showcase pill is where part 2 goes.' : 'The whole message the lead gets.'}>
              <TokenField ref={msgRef} initial={template} tokens={tokens} label="Message template" minHeight={hasPitch ? 104 : 140} onChange={setValue} />
            </Section>

            {hasPitch && (
              <Section step={2} icon={Home} title="Showcase pitch" custom={isCustomPitch}
                hint={pitchStyle === 'intro'
                  ? "They didn't ask for a Showcase here - it was built from their answers, so this introduces it."
                  : 'They already know about their Showcase - this nudges them back to it.'}>
                <TokenField ref={pitchRef} initial={pitch || ''} tokens={pitchTokens!} label="Showcase pitch template" minHeight={96} onChange={setPitchValue} />
                <AnimatePresence initial={false}>
                  {!pitchPlaced && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Add the green Showcase pill to part 1, or this part won&apos;t be sent.
                    </motion.p>
                  )}
                </AnimatePresence>
                <p className="mt-1.5 text-[10px] font-semibold text-gray-400">
                  Only sent when the guest has a Showcase. The link is always included{pitchHasLink ? '' : ' - it goes at the end'}; a sentence naming a home is only sent when one was listed in the last 3 weeks - otherwise it&apos;s skipped.
                </p>
              </Section>
            )}
          </div>

          {FILL_IN_RE.test(value) && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <PenLine className="mt-px h-3.5 w-3.5 shrink-0" /> The part in [BRACKETS] is for you to fill in when you copy it - the calendar alert reminds you, too.
            </p>
          )}
          {signature && (
            <p className="mt-2 text-[10px] font-semibold text-gray-400">
              Every message ends with your sign-off: <span className="whitespace-pre-wrap font-black text-gray-500 dark:text-gray-300">{signature.replace('\n', ' ')}</span>. It comes from your name and brokerage in Settings.
            </p>
          )}

          <div className="mt-1.5 flex justify-end">
            <p className={`text-[10px] font-bold ${Math.max(value.length, pitchValue.length) > MAX - 100 ? 'text-red-500' : 'text-gray-400'}`}>
              {value.length}/{MAX}{hasPitch ? ` · ${pitchValue.length}/${MAX}` : ''}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              disabled={!changed || !value.trim() || saving}
              onClick={() => onSave(hasPitch ? { template: value, pitch: pitchValue } : { template: value })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2 text-xs font-black text-white shadow-sm transition hover:brightness-110 disabled:opacity-40 dark:bg-white dark:text-[#111827]"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save message
            </motion.button>
            <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-xs font-black text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10">
              {changed ? 'Cancel' : 'Close'}
            </button>
            {!atDefault && (
              <button type="button" onClick={reset} className="ml-auto inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-[#8b7355] hover:bg-[#C9A24D]/10 dark:text-[#d7b974]">
                <RotateCcw className="h-3.5 w-3.5" /> Reset to default
              </button>
            )}
          </div>
        </div>

        {/* Live preview, as the lead would get it */}
        <div className="min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Live preview · sample lead</p>
            {ruleKey && (
              <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-white/5">
                {([['text', 'Text'], ['calendar', 'Calendar alert']] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setPreviewTab(k)}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition ${previewTab === k ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827]' : 'text-gray-400 hover:text-[#111827] dark:hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {ruleKey && previewTab === 'calendar' ? (
            <div className="mt-2 lg:sticky lg:top-4">
              <CalendarAlertPreview ruleKey={ruleKey} template={value} pitch={hasPitch ? pitchValue : undefined} seller={seller} />
              <p className="mt-1.5 text-[9px] font-semibold text-gray-400">Exactly what the event says on your calendar - links are tappable there.</p>
            </div>
          ) : (
          <div className="mt-2 rounded-[1.6rem] bg-gradient-to-b from-[#1f2937] to-[#0b0b0b] p-3 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.7)] lg:sticky lg:top-4">
            <div className="mb-2 flex items-center justify-center gap-1 text-[10px] font-bold text-white/50">
              <User className="h-3 w-3" /> Jane Buyer
            </div>
            <motion.div layout className="ml-auto max-w-[94%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#0a84ff] px-3 py-2 text-[12.5px] leading-snug text-white">
              {preview.length ? preview.map((p, i) => (
                // The pitch is always its own paragraph in the real message (tasks_service.full_message).
                p.link
                  ? <span key={i} className="rounded bg-white/20 px-0.5 font-semibold underline">{p.text}</span>
                  : p.kind
                    ? <span key={i} className="rounded bg-white/20 px-0.5 font-semibold">{p.text}</span>
                    : <span key={i}>{p.text.split(FILL_IN_RE).map((bit, j) => j % 2
                        ? <span key={j} className="rounded bg-amber-300 px-1 font-black text-[#111827]">{bit}</span>
                        : bit)}</span>
              )) : <span className="opacity-60">Your message…</span>}
              {signature && preview.length > 0 && <span className="mt-2 block opacity-80">{signature}</span>}
            </motion.div>
            <p className="mt-1.5 text-right text-[9px] font-semibold text-white/40">Highlighted = filled in for each lead</p>
          </div>
          )}
        </div>
      </div>
      {footer}
    </motion.div>
  )
}
