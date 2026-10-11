'use client'

import { useEffect, useRef } from 'react'
import { Download } from 'lucide-react'
import { qrDataUrl } from '@/lib/qr'

// `bare`: just the code, no frame or button - for an off-screen copy that only powers a Download
// QR button elsewhere (it can sit inside a clickable card without nesting buttons).
export default function FormQrCode({ url, size = 168, onDownloadReady, bare = false }: { url: string; size?: number; onDownloadReady?: (fn: () => void) => void; bare?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const compact = size < 100

  useEffect(() => {
    if (!canvasRef.current) return
    const qrUrl = `${url}${url.includes('?') ? '&' : '?'}src=qr`
    // The site-wide QR look (lib/qrStyle), drawn at 3x (at least 1024px) so the downloaded PNG prints sharp.
    const canvas = canvasRef.current
    const px = Math.max(size * 3, 1024)
    let live = true
    qrDataUrl(qrUrl, { size: px, dark: '#111827' }).then(src => {
      const img = new Image()
      img.onload = () => {
        if (!live || !canvas) return
        canvas.width = px; canvas.height = px
        canvas.style.width = `${size}px`; canvas.style.height = `${size}px`
        canvas.getContext('2d')?.drawImage(img, 0, 0, px, px)
      }
      img.src = src
    }).catch(() => {})
    return () => { live = false }
  }, [url, size])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = 'form-qr-code.png'
      link.click()
      URL.revokeObjectURL(objectUrl)
    })
  }

  // Callers that pass an inline arrow (e.g. `onDownloadReady={fn => setX(() => fn)}`) create a
  // new function every render, so depending on `onDownloadReady` directly re-fires this effect
  // every time it's called, which for a caller storing it in state loops forever ("Maximum
  // update depth exceeded"). A ref sidesteps that: report the download function exactly once on
  // mount, regardless of whether the caller's own prop reference is stable.
  const onDownloadReadyRef = useRef(onDownloadReady)
  onDownloadReadyRef.current = onDownloadReady
  useEffect(() => {
    onDownloadReadyRef.current?.(handleDownload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (bare) return <canvas ref={canvasRef} />

  if (compact) {
    return (
      <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-white">
        <canvas ref={canvasRef} className="rounded" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-gray-200 bg-[#fbfaf7] p-4">
      <canvas ref={canvasRef} className="rounded-lg" />
      <button onClick={handleDownload} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-black">
        <Download className="h-4 w-4" /> Download QR
      </button>
    </div>
  )
}
