'use client'

// Saving / opening a generated PDF without ever leaving the page (user, 10/21: "Download PDF"
// opened the PDF on the same page, losing their place in the CMA). The PDF is built only when a
// button is clicked (react-pdf's PDFDownloadLink renders the whole document on page load).
// - Download: a real file download. iPhones/iPads can't save a generated file from a web page, so
//   there it opens in a new tab, where Share -> Save to Files works.
// - Open: always a new tab. The tab is opened during the click (before the PDF is ready) so pop-up
//   blockers allow it, then pointed at the file.
import { pdf } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function openPlaceholderTab(): Window | null {
  const w = window.open('', '_blank')
  if (w) {
    try {
      w.document.title = 'Preparing your PDF…'
      w.document.body.style.cssText = 'margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font:600 15px system-ui,sans-serif;color:#555;background:#f6f5f1'
      w.document.body.textContent = 'Preparing your PDF…'
    } catch { /* cross-origin about:blank quirks - the tab still gets the PDF below */ }
  }
  return w
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

function showInTab(w: Window, blob: Blob) {
  const url = URL.createObjectURL(blob)
  w.location.href = url
  setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000)
}

/** Download the PDF as a file. Call straight from a click handler. */
export async function downloadPdf(doc: ReactElement, fileName: string): Promise<void> {
  const tab = isIOS() ? openPlaceholderTab() : null
  try {
    const blob = await build(doc)
    if (tab) showInTab(tab, blob)
    else saveBlob(blob, fileName)
  } catch (e) {
    tab?.close()
    throw e
  }
}

/** Open the PDF in a new tab (the CMA page stays where it is). Call straight from a click handler. */
export async function openPdf(doc: ReactElement, fileName: string): Promise<void> {
  const tab = openPlaceholderTab()
  try {
    const blob = await build(doc)
    if (tab) showInTab(tab, blob)
    else saveBlob(blob, fileName) // pop-ups blocked: fall back to a download rather than nothing
  } catch (e) {
    tab?.close()
    throw e
  }
}
