'use client'

// Typing on the report itself (Review step). The SAME elements a client reads become editable: no boxes of
// their own, so what the agent sees while typing is what the client gets. Plain text only - the report has no
// bold / links - and a paste is always pasted as plain words.
import { useEffect, useLayoutEffect, useRef } from 'react'

const clean = (s: string, multiline: boolean) => {
  let t = s.replace(/ /g, ' ').replace(/\r/g, '')
  if (!multiline) t = t.replace(/\s*\n+\s*/g, ' ')
  return t.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/^\n+|\n+$/g, '')
}

/** The gold "you can type here" look shared by every editable spot (globals.css .cma-edit-spot). */
export const EDIT_SPOT = 'cma-edit-spot cursor-text rounded-[6px]'

function makeEditable(el: HTMLElement) {
  // plain-text editing where the browser has it; elsewhere rich editing with our own plain paste
  try { el.contentEditable = 'plaintext-only' } catch { /* older browser */ }
  if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true'
}

export function EditableText({ value, onChange, placeholder = 'Type here', multiline = true, className = '', as: Tag = 'p', label, onEnter, onEmptyBackspace }: {
  value: string
  onChange: (text: string) => void
  placeholder?: string
  multiline?: boolean
  className?: string
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'div'
  /** What this is, for screen readers ("Offer suggestion"). */
  label?: string
  /** Enter on a one-line spot (it never adds a line break there). */
  onEnter?: () => void
  /** Backspace in an already-empty spot (used to remove an empty paragraph). */
  onEmptyBackspace?: () => void
}) {
  const ref = useRef<HTMLElement | null>(null)
  const last = useRef(value)

  // The page's words come from state only while the agent is NOT typing in this spot - redrawing it mid-word
  // would throw the caret to the start.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (document.activeElement === el && last.current === value) return   // our own typing coming back
    if ((el.textContent || '') !== value) el.textContent = value
    last.current = value
  }, [value])

  useEffect(() => { if (ref.current) makeEditable(ref.current) }, [])

  const read = () => {
    const el = ref.current
    if (!el) return
    const text = clean(el.innerText || '', multiline)
    if (!text && el.innerHTML) el.innerHTML = ''   // so the placeholder shows again
    if (text === last.current) return
    last.current = text
    onChange(text)
  }

  const T = Tag as 'p'
  return (
    <T
      ref={ref as React.RefObject<HTMLParagraphElement>}
      role="textbox"
      aria-multiline={multiline}
      aria-label={label || placeholder}
      data-placeholder={placeholder}
      spellCheck
      suppressContentEditableWarning
      onInput={read}
      onBlur={() => {
        const el = ref.current
        if (!el) return
        read()
        // tidy anything a browser left behind (a stray <br> or <div>)
        if ((el.textContent || '') !== last.current || el.children.length) el.textContent = last.current
      }}
      onPaste={e => {
        e.preventDefault()
        const text = clean(e.clipboardData.getData('text/plain') || '', multiline)
        if (text) document.execCommand('insertText', false, text)
      }}
      onDrop={e => e.preventDefault()}
      onKeyDown={e => {
        if (e.key === 'Enter' && !multiline) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); onEnter?.() }
        else if (e.key === 'Escape') { (e.currentTarget as HTMLElement).blur() }
        else if (e.key === 'Backspace' && onEmptyBackspace && !(ref.current?.innerText || '').trim()) { e.preventDefault(); onEmptyBackspace() }
      }}
      className={`${EDIT_SPOT} ${multiline ? 'whitespace-pre-wrap' : ''} ${className}`}
    />
  )
}

const digits = (s: string) => s.replace(/[^\d]/g, '')
const money = (d: string) => (d ? `$${Number(d).toLocaleString('en-US')}` : '')

/** A dollar figure typed in place: shows "$378,000"; tap it and type the number (it stays formatted as you go).
 *  Not an <input> on purpose: it keeps the exact type of the figure it replaces, at any size. */
export function EditableMoney({ value, onChange, className = '', label, emptyLabel = 'Add' }: {
  value: number | null
  onChange: (v: number | null) => void
  className?: string
  label: string
  /** Shown when there is no number yet. */
  emptyLabel?: string
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const shown = value != null ? money(String(Math.round(value))) : ''
  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && (el.textContent || '') !== shown) el.textContent = shown
  }, [shown])
  useEffect(() => { if (ref.current) makeEditable(ref.current) }, [])
  const caretToEnd = (el: HTMLElement) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
  const commit = () => {
    const el = ref.current
    if (!el) return
    const d = digits(el.textContent || '').slice(0, 10)
    const next = d && Number(d) > 0 ? Number(d) : null
    el.textContent = next != null ? money(String(next)) : ''
    if (next !== (value != null ? Math.round(value) : null)) onChange(next)
  }
  return (
    <span
      ref={ref}
      role="textbox"
      inputMode="numeric"
      aria-label={label}
      data-placeholder={emptyLabel}
      suppressContentEditableWarning
      onFocus={e => { const el = e.currentTarget; requestAnimationFrame(() => caretToEnd(el)) }}
      onInput={e => {
        const el = e.currentTarget
        const next = money(digits(el.textContent || '').slice(0, 10))
        if ((el.textContent || '') !== next) { el.textContent = next; caretToEnd(el) }
        if (!next && el.innerHTML) el.innerHTML = ''
      }}
      onBlur={commit}
      onPaste={e => { e.preventDefault(); const d = digits(e.clipboardData.getData('text/plain') || ''); if (d) document.execCommand('insertText', false, d) }}
      onDrop={e => e.preventDefault()}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
        else if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.textContent = shown; e.currentTarget.blur() }
      }}
      className={`${EDIT_SPOT} inline-block min-w-[2.5ch] tabular-nums ${className}`}
    />
  )
}
