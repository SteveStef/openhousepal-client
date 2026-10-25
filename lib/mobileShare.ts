'use client'

// One rule for "Download" and "Share" buttons site-wide (user, 10/24):
// - Download on a phone opens the phone's Share sheet with the file, so "Save Image" / "Save to
//   Files" is one tap away - never a file buried in the Downloads folder, never the file opened
//   in the same tab. On a computer it simply downloads.
// - Share on a phone opens the Share sheet with the link; on a computer it copies the link (the
//   button then says "Copied").
// PDFs built on the fly on iPhone should keep using lib/pdfFile (it builds ahead of the tap).

export function isTouchPhone(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const android = /Android/i.test(navigator.userAgent)
  return ios || android || (window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 900)
}

export function downloadBlob(blob: Blob, fileName: string) {
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

/** Phone: Share sheet with the file (falls back to a download if the phone can't share files).
 *  Computer: plain download. Call inside the tap handler; build the blob ahead of time on iPhone
 *  when it takes more than a moment, or Safari drops the Share sheet. */
export async function saveFile(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (isTouchPhone() && typeof File !== 'undefined') {
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return 'shared'
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return 'cancelled'
      }
    }
  }
  downloadBlob(blob, fileName)
  return 'downloaded'
}

/** Fetches a file by URL (same-origin or CORS-enabled) and saves it with saveFile. */
export async function saveFileFromUrl(url: string, fileName: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed (${res.status})`)
  return saveFile(await res.blob(), fileName)
}

/** Phone: Share sheet with the link. Computer: copies it. Returns what happened so the button can
 *  say "Copied". */
export async function shareLink(url: string, title?: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (isTouchPhone() && navigator.share) {
    try {
      await navigator.share(title ? { url, title } : { url })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}
