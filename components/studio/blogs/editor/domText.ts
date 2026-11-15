// Caret helpers for the blog editor's text spots (contentEditable elements on the article page).
// Everything here reads the page; nothing changes it except `setCaret`.

/** The live selection, when it sits inside `host`. */
export function rangeIn(host: HTMLElement): Range | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  return host.contains(range.startContainer) && host.contains(range.endContainer) ? range : null
}

// Range-boundary comparison, not offset math, so it stays right across bold / italic / link spans.
export function caretAtStart(host: HTMLElement, range: Range): boolean {
  const r = document.createRange()
  r.selectNodeContents(host)
  r.setEnd(range.startContainer, range.startOffset)
  return r.toString().length === 0
}
export function caretAtEnd(host: HTMLElement, range: Range): boolean {
  const r = document.createRange()
  r.selectNodeContents(host)
  r.setStart(range.endContainer, range.endOffset)
  return r.toString().length === 0
}

const htmlOfRange = (r: Range) => {
  const holder = document.createElement('div')
  holder.appendChild(r.cloneContents())
  return holder.innerHTML
}

/** The host's content on each side of the caret (a selection counts as already typed over). */
export function splitAtCaret(host: HTMLElement): { beforeHtml: string; afterHtml: string; before: string; after: string } | null {
  const range = rangeIn(host)
  if (!range) return null
  const head = document.createRange()
  head.selectNodeContents(host)
  head.setEnd(range.startContainer, range.startOffset)
  const tail = document.createRange()
  tail.selectNodeContents(host)
  tail.setStart(range.endContainer, range.endOffset)
  return { beforeHtml: htmlOfRange(head), afterHtml: htmlOfRange(tail), before: head.toString(), after: tail.toString() }
}

/** Puts the caret in `host`: its start, its end, or after that many characters. */
export function setCaret(host: HTMLElement, at: 'start' | 'end' | number) {
  host.focus({ preventScroll: true })
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  if (typeof at === 'number') {
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
    let left = at
    let node = walker.nextNode() as Text | null
    let placed = false
    while (node) {
      if (left <= node.length) { range.setStart(node, left); placed = true; break }
      left -= node.length
      node = walker.nextNode() as Text | null
    }
    if (!placed) { range.selectNodeContents(host); range.collapse(false) } else range.collapse(true)
  } else {
    range.selectNodeContents(host)
    range.collapse(at === 'start')
  }
  sel.removeAllRanges()
  sel.addRange(range)
}

/** How many characters into `el` a click at (x, y) landed. */
export function offsetFromPoint(el: HTMLElement, x: number, y: number): number | null {
  const doc = document as any
  let node: Node | null = null
  let offset = 0
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos) { node = pos.offsetNode; offset = pos.offset }
  } else if (doc.caretRangeFromPoint) {
    const r: Range | null = doc.caretRangeFromPoint(x, y)
    if (r) { node = r.startContainer; offset = r.startOffset }
  }
  if (!node || !el.contains(node)) return null
  const r = document.createRange()
  r.selectNodeContents(el)
  try { r.setEnd(node, offset) } catch { return null }
  return r.toString().length
}

/** "<block id>:<field>" -> its two parts (block ids never hold the last colon). */
export function parseHost(key: string): { id: string; field: string } {
  const i = key.lastIndexOf(':')
  return { id: key.slice(0, i), field: key.slice(i + 1) }
}

/** An emptied text spot often keeps a stray <br>; without it the placeholder shows again. */
export function tidyEmpty(host: HTMLElement) {
  if (host.textContent === '' && host.innerHTML !== '' && !host.querySelector('img')) host.innerHTML = ''
}
