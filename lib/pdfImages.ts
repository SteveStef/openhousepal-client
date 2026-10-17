// pdf.js (loaded once, from cdnjs, only when needed) draws real PDF pages as pictures. An embedded
// PDF viewer is blank on Android Chrome and lands zoomed-in on iPhones; a picture shows the whole
// page the same everywhere. Used by the kit Review step and the phone print preview.

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174'
let pdfjsLoading: Promise<any> | null = null

export function loadPdfJs(): Promise<any> {
  const w = window as any
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib)
  if (!pdfjsLoading) {
    pdfjsLoading = new Promise((resolve, reject) => {
      const tag = document.createElement('script')
      tag.src = `${PDFJS}/pdf.min.js`
      tag.async = true
      tag.onload = () => { w.pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS}/pdf.worker.min.js`; resolve(w.pdfjsLib) }
      tag.onerror = () => { pdfjsLoading = null; reject(new Error('pdf.js did not load')) }
      document.head.appendChild(tag)
    })
  }
  return pdfjsLoading
}

/** Every page (up to `maxPages`) as a JPEG data URL, `cssWidth` wide on screen. */
export async function pdfPageImages(blob: Blob, cssWidth: number, maxPages = 12): Promise<string[]> {
  const lib = await loadPdfJs()
  const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
  try {
    const out: string[] = []
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: (cssWidth * Math.min(2, window.devicePixelRatio || 1)) / base.width })
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(viewport.width)
      canvas.height = Math.round(viewport.height)
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      out.push(canvas.toDataURL('image/jpeg', 0.88))
    }
    return out
  } finally {
    doc.destroy()
  }
}

export async function pdfFirstPageImage(blob: Blob, cssWidth: number): Promise<string> {
  return (await pdfPageImages(blob, cssWidth, 1))[0]
}

/** Phone share sheet with the PDF attached (Save to Files, Mail, Messages, Print...). Returns
 *  false when this browser can't share files (desktop), so the caller can download instead. */
export async function sharePdf(blob: Blob, fileName: string, title: string): Promise<'shared' | 'cancelled' | false> {
  try {
    const file = new File([blob], fileName, { type: 'application/pdf' })
    const nav = navigator as any
    if (!nav.canShare || !nav.canShare({ files: [file] })) return false
    await nav.share({ files: [file], title })
    return 'shared'
  } catch (e: any) {
    return e?.name === 'AbortError' ? 'cancelled' : false
  }
}
