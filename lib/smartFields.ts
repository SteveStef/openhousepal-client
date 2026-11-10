'use client'

import { useEffect } from 'react'

// Smart field hops for guest forms (user, 11/10).
//
// When a guest taps the phone's autofill suggestion (the iPhone's QuickType bar above the keyboard:
// their name, email, phone) or the browser autofills a field, the form should move on by itself:
//   - not the last field of this step  -> focus the next empty field
//   - the last field of this step      -> close the keyboard (blur)
// The keyboard's Enter / "Next" / "Go" key does the same: next field, or close the keyboard on the
// last one. A form that already does something on Enter from its last field (a submit button, a
// "Press Enter" step form) keeps doing exactly that.
//
// Typing letter by letter never moves anything. Only a fill that lands a whole, finished-looking
// value (a real email, a full phone number, a first + last name) counts, so a half fill (just a
// first name in a full-name box) or the phone's word suggestions in a normal text box stay put.
//
// How to use: spread what useSmartFields() returns onto the form's outer element. One listener on
// the page serves every marked form. A form shown one step at a time marks each step's box with
// data-smart-step so "last field" means the last one of that step.
//
//   const smartFields = useSmartFields()           // Enter on the last field: auto
//   <form {...smartFields}> ... </form>
//
// Modes for the last field's Enter key:
//   'auto' (default) - a form with a submit button (or a lone box) keeps its own Enter; else blur
//   'pass'           - always leave the last field's Enter to the form (step forms, "Press Enter")
//   'blur'           - always just close the keyboard
export type SmartEnterMode = 'auto' | 'pass' | 'blur'

const ROOT_ATTR = 'data-smart-fields'
const STEP_ATTR = 'data-smart-step'
const HINT_MARK = 'data-smart-hint'

// Field types a hop may land on. Pickers (date, select, color...) and boxes the guest can't type in
// are never jumped into - focusing one would pop a wheel or calendar open by surprise.
const SKIP_TYPES = new Set(['hidden', 'checkbox', 'radio', 'button', 'submit', 'reset', 'image', 'file', 'range', 'color', 'date', 'time', 'datetime-local', 'month', 'week', 'search'])

type Field = HTMLInputElement | HTMLTextAreaElement

function isField(el: EventTarget | null): el is Field {
  if (el instanceof HTMLTextAreaElement) return true
  return el instanceof HTMLInputElement && !SKIP_TYPES.has((el.type || 'text').toLowerCase())
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected || el.getClientRects().length === 0) return false
  if (el.closest('[aria-hidden="true"], [inert]')) return false
  const cs = window.getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none'
}

// A field a hop can land on.
function isTarget(el: Element): el is Field {
  if (!isField(el)) return false
  if (el.disabled || el.readOnly || el.tabIndex < 0) return false
  if (el.hasAttribute('data-smart-skip')) return false
  if ((el.getAttribute('enterkeyhint') || '').toLowerCase() === 'search') return false
  return isVisible(el)
}

// A field whose Enter key / autofill this helper is allowed to act on. Search boxes and suggestion
// lists (Google address picker, home search) keep Enter for picking a suggestion.
function isSource(el: Field): boolean {
  if (!isTarget(el)) return false
  if (el instanceof HTMLTextAreaElement) return false
  const ac = (el.getAttribute('autocomplete') || '').toLowerCase()
  if (ac === 'off') return false
  if (el.getAttribute('role') === 'combobox' || el.hasAttribute('aria-autocomplete') || el.getAttribute('aria-expanded') === 'true') return false
  return true
}

// The box handles its own keys (a pick-from-list box choosing a match on Enter, a one-box step
// moving on): leave its Enter alone. Read from React's props on the element.
function hasOwnKeyHandler(el: Element): boolean {
  try {
    const key = Object.keys(el).find(k => k.startsWith('__reactProps$'))
    const props = key ? (el as unknown as Record<string, { onKeyDown?: unknown; onKeyDownCapture?: unknown } | undefined>)[key] : undefined
    return !!(props && (props.onKeyDown || props.onKeyDownCapture))
  } catch { return false }
}

function rootOf(el: Element): HTMLElement | null {
  return el.closest<HTMLElement>(`[${ROOT_ATTR}]`)
}

// The step the field belongs to: a marked step box, else its <form>, else the whole marked root.
function scopeOf(el: Element, root: HTMLElement): HTMLElement {
  const step = el.closest<HTMLElement>(`[${STEP_ATTR}]`)
  if (step && root.contains(step)) return step
  const form = (el as Field).form
  if (form && root.contains(form)) return form
  if (form && form.contains(root)) return root
  return root
}

function fieldsIn(scope: HTMLElement): Field[] {
  return Array.from(scope.querySelectorAll<Field>('input, textarea')).filter(isTarget)
}

function fieldsAfter(el: Field, root: HTMLElement): Field[] {
  const all = fieldsIn(scopeOf(el, root))
  const i = all.indexOf(el)
  return i < 0 ? [] : all.slice(i + 1)
}

// What kind of contact box this is - from its autocomplete hint, type, or name/id.
type Kind = 'email' | 'tel' | 'name' | 'given' | 'family' | 'postal' | 'address' | 'city' | null
function kindOf(el: Field): Kind {
  const ac = (el.getAttribute('autocomplete') || '').toLowerCase()
  const type = (el.getAttribute('type') || '').toLowerCase()
  const key = `${el.name || ''} ${el.id || ''}`.toLowerCase()
  if (/\bemail\b/.test(ac) || type === 'email') return 'email'
  if (/\btel(-national)?\b/.test(ac) || type === 'tel') return 'tel'
  if (/\bgiven-name\b/.test(ac)) return 'given'
  if (/\bfamily-name\b/.test(ac)) return 'family'
  if (/\bname\b/.test(ac)) return 'name'
  if (/\bpostal-code\b/.test(ac)) return 'postal'
  if (/\b(street-address|address-line1)\b/.test(ac)) return 'address'
  if (/\baddress-level2\b/.test(ac)) return 'city'
  if (/email/.test(key)) return 'email'
  if (/phone|mobile|\btel\b/.test(key)) return 'tel'
  if (/first.?name|given/.test(key)) return 'given'
  if (/last.?name|family|surname/.test(key)) return 'family'
  if (/full.?name|^name\b/.test(key.trim())) return 'name'
  return null
}

// Does the box now hold a whole, finished answer (not a half fill)?
function looksComplete(el: Field): boolean {
  const v = el.value.trim()
  if (!v) return false
  switch (kindOf(el)) {
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
    case 'tel': return v.replace(/\D/g, '').length >= 10
    case 'name': return /\S{1,}\s+\S{2,}/.test(v)
    case 'given':
    case 'family': return v.length >= 2
    case 'postal': return /^\d{5}(-\d{4})?$/.test(v) || v.length >= 5
    case 'address': return /\d/.test(v) && /\s/.test(v) && v.length >= 6
    case 'city': return v.length >= 3
    default: return false
  }
}

function isBrowserAutofilled(el: Field): boolean {
  try { return el.matches(':-webkit-autofill') || el.matches(':autofill') } catch { return false }
}

function blurField(el: Field) {
  el.blur()
}
function focusField(el: Field) {
  try { el.focus({ preventScroll: false }) } catch { el.focus() }
  // Caret at the end, the way a tap-to-type leaves it (email boxes can't set a selection).
  try { const n = el.value.length; el.setSelectionRange(n, n) } catch { /* type=email */ }
}

// ---- the one page-wide listener ----

let installs = 0
let teardown: (() => void) | null = null

function install() {
  if (typeof document === 'undefined') return () => {}
  installs += 1
  if (installs === 1) {
    const lastValue = new WeakMap<Field, string>()
    const lastKeyAt = new WeakMap<Field, number>()
    let pending: number | null = null

    const remember = (el: Field) => lastValue.set(el, el.value)

    const onFocusIn = (e: FocusEvent) => {
      const el = e.target
      if (!isField(el)) return
      const root = rootOf(el)
      if (!root) return
      remember(el)
      // The keyboard's action key reads "next" while there's another box in this step. Only when
      // the page didn't pick a label of its own.
      if (!isSource(el) || hasOwnKeyHandler(el)) return
      const own =el.hasAttribute('enterkeyhint') && !el.hasAttribute(HINT_MARK)
      if (own) return
      if (fieldsAfter(el, root).length > 0) {
        el.setAttribute('enterkeyhint', 'next')
        el.setAttribute(HINT_MARK, '')
      } else if (el.hasAttribute(HINT_MARK)) {
        el.removeAttribute('enterkeyhint')
        el.removeAttribute(HINT_MARK)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target
      if (!isField(el)) return
      lastKeyAt.set(el, Date.now())
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing || e.keyCode === 229) return
      if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return
      const root = rootOf(el)
      if (!root || !isSource(el) || hasOwnKeyHandler(el)) return
      // Google's address suggestions are open: Enter picks one.
      if (Array.from(document.querySelectorAll<HTMLElement>('.pac-container')).some(p => p.offsetParent !== null && p.querySelector('.pac-item'))) return
      const next = fieldsAfter(el, root)[0]
      if (next) {
        e.preventDefault()
        e.stopPropagation()
        focusField(next)
        return
      }
      // Last field of the step.
      const mode = (root.getAttribute(ROOT_ATTR) || 'auto') as SmartEnterMode
      if (mode === 'pass') return
      if (mode === 'auto') {
        const form = (el as HTMLInputElement).form
        if (form) {
          // The browser's own Enter-to-send uses the form's first submit button - unless it's greyed
          // out (form not finished yet), in which case Enter would do nothing: close the keyboard.
          const submit = form.querySelector<HTMLButtonElement | HTMLInputElement>('button[type="submit"], input[type="submit"], button:not([type])')
          const lone = fieldsIn(form).filter(f => f instanceof HTMLInputElement).length === 1
          if ((submit && !submit.disabled) || (!submit && lone)) return
        }
      }
      // Nothing else listens: just close the keyboard. (Other handlers still see the key.)
      blurField(el)
    }

    const onInput = (e: Event) => {
      const el = e.target
      if (!isField(el)) return
      const root = rootOf(el)
      if (!root) return
      const before = lastValue.get(el) ?? ''
      // The page may reformat the value (phone dashes) on this same event - read it after.
      window.setTimeout(() => remember(el), 0)
      if (!isSource(el) || document.activeElement !== el) return
      const inputType = (e as InputEvent).inputType
      const after = el.value
      let filled = false
      if (inputType === 'insertReplacementText') {
        // iPhone QuickType / autofill pick. (Also fires for autocorrect - looksComplete keeps that put.)
        filled = before ? (after.length - before.length >= 2 || !after.startsWith(before)) : after.length >= 2
      } else if (!inputType) {
        // Browser autofill (no keystroke): a jump of 2+ characters, or the browser's autofill mark.
        const typedJustNow = Date.now() - (lastKeyAt.get(el) || 0) < 120
        filled = !typedJustNow && (isBrowserAutofilled(el) || after.length - before.length >= 2)
      }
      if (!filled) return
      if (pending) window.clearTimeout(pending)
      // A beat later: the page re-renders the value, and a contact-card fill lands the other boxes.
      pending = window.setTimeout(() => {
        pending = null
        if (document.activeElement !== el || !el.isConnected || !looksComplete(el)) return
        const r = rootOf(el)
        if (!r) return
        const next = fieldsAfter(el, r).find(f => !f.value.trim())
        if (next) focusField(next)
        else blurField(el)
      }, 90)
    }

    document.addEventListener('focusin', onFocusIn, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('input', onInput, true)
    teardown = () => {
      document.removeEventListener('focusin', onFocusIn, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('input', onInput, true)
      if (pending) window.clearTimeout(pending)
    }
  }
  return () => {
    installs -= 1
    if (installs === 0 && teardown) { teardown(); teardown = null }
  }
}

// Turns smart field hops on for a guest form. Spread the result onto the form's outer element.
export function useSmartFields(mode: SmartEnterMode = 'auto'): { [ROOT_ATTR]: SmartEnterMode } {
  useEffect(() => install(), [])
  return { [ROOT_ATTR]: mode }
}

// Mark a step's box inside a step-by-step form, so "last field" means the last of that step.
export const smartStep = { [STEP_ATTR]: '' } as const
