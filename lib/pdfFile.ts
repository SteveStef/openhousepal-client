'use client'

// Saving / opening a generated PDF without ever leaving the page (user, 10/21: "Download PDF"
// opened the PDF on the same page, losing their place in the CMA).
// - Computers / Android: the PDF is built on click, then downloaded (or opened in a new tab).
// - iPhone / iPad: Safari only lets a page open a tab or the Share sheet DURING the tap, and
//   building the PDF takes seconds - so a build-then-open on tap landed in the same tab (still
//   happening after the first fix, user 10/21). There the PDF is built ahead of time
//   (usePdfFile), and the tap hands the ready file to the Share sheet (Save to Files, AirDrop,
//   Mail...) or a new tab - instantly, inside the tap. Tapped before it's ready, the button says
//   "Preparing…", then "Tap to save", and the next tap works.
import { pdf } from '@react-pdf/renderer'
import { useEffect, useRef, useState, type ReactElement } from 'react'

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

async function build(doc: ReactElement): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return pdf(doc as any).toBlob()
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

function openPlaceholderTab(): Window | null {
  const w = window.open('', '_blank')
  if (w) {
    try {
      w.document.title = 'Preparing your PDF…'
      w.document.body.style.cssText = 'margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font:600 15px system-ui,sans-serif;color:#555;background:#f6f5f1'
      w.document.body.textContent = 'Preparing your PDF…'
    } catch { /* about:blank quirks - the tab still gets the PDF below */ }
  }
  return w
}

/** iPhone: hand an already-built PDF over inside the tap. Share sheet first for "save"; a new tab
 *  first for "open" (falling back to the other when the device refuses). */
function deliverOnIOS(blob: Blob, fileName: string, prefer: 'share' | 'tab'): boolean {
  const file = typeof File !== 'undefined' ? new File([blob], fileName, { type: 'application/pdf' }) : null
  const canShare = !!(file && navigator.canShare?.({ files: [file] }))
  // the file only: iOS "Save to Files" also saved a `title` as a second file named "text" (user, 10/21)
  const share = () => { navigator.share({ files: [file as File] }).catch(() => { /* closed the sheet */ }); return true }
  const tab = () => {
    const url = URL.createObjectURL(blob)
    const w = window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)
    return !!w
  }
  if (prefer === 'share') return (canShare && share()) || tab()
  return tab() || (canShare && share())
}

/** Builds the PDF ahead of time on iPhone/iPad so a tap can hand it over instantly. `key` changes
 *  when the document's content does (rebuilds then); `enabled` false until the data is ready. */
export function usePdfFile(makeDoc: () => ReactElement | null, fileName: string, key: string, enabled: boolean) {
  const [ios, setIos] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [state, setState] = useState<'idle' | 'building' | 'ready' | 'error'>('idle')
  // a tap came before the file was ready - the next tap hands it over
  const [needsTap, setNeedsTap] = useState(false)
  const make = useRef(makeDoc)
  make.current = makeDoc
  useEffect(() => { setIos(isIOS()) }, [])
  useEffect(() => {
    if (!ios || !enabled) return
    let cancelled = false
    setBlob(null)
    setState('building')
    const doc = make.current()
    if (!doc) { setState('idle'); return }
    build(doc).then(b => { if (!cancelled) { setBlob(b); setState('ready') } })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [ios, enabled, key])

  /** Click handler for Download ('share') / Open PDF ('tab'). Resolves once handed over. */
  const run = async (prefer: 'share' | 'tab') => {
    const doc = make.current()
    if (!doc) return
    if (ios) {
      if (blob) { setNeedsTap(false); deliverOnIOS(blob, fileName, prefer); return }
      // not built yet: the tap is spent, so the button asks for one more tap once it's ready
      setNeedsTap(true)
      if (state !== 'building') {
        setState('building')
        try { setBlob(await build(doc)); setState('ready') } catch { setState('error'); throw new Error('pdf') }
      }
      return
    }
    if (prefer === 'tab') {
      const tabWin = openPlaceholderTab()
      try {
        const b = await build(doc)
        if (tabWin) {
          const url = URL.createObjectURL(b)
          tabWin.location.href = url
          setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)
        } else saveBlob(b, fileName) // pop-ups blocked: a download rather than nothing
      } catch (e) { tabWin?.close(); throw e }
      return
    }
    saveBlob(await build(doc), fileName)
  }

  /** On iPhone, what the buttons should say right now. */
  const iosHint: '' | 'preparing' | 'tap' = ios && needsTap ? (state === 'building' ? 'preparing' : blob ? 'tap' : '') : ''
  return { run, ios, iosHint }
}
