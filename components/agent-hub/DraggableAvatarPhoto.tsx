'use client'

import { useRef } from 'react'
import { Loader2 } from 'lucide-react'

// Circular profile photo preview that can be dragged to reposition the crop, so a photo that
// isn't centered on the subject doesn't get clipped by the round frame. Position is a % pair
// (background-position), same pattern as the cheat sheet's DraggablePreviewPhoto but for a
// circular avatar backed by CSS background-image instead of a <Image> with objectPosition.
export default function DraggableAvatarPhoto({ url, position, onPositionChange, onDragEnd, size = 64, uploading, ringColor }: {
  url?: string
  position?: { x: number; y: number }
  onPositionChange: (position: { x: number; y: number }) => void
  // Optional: fires once when the drag actually ends (pointer up/cancel), with the final
  // position - lets a caller that does something expensive on every position change (an API
  // save, rebuilding a big preview) defer that to drag-end instead of firing it on every
  // in-between pixel that onPositionChange reports during the drag itself.
  onDragEnd?: (position: { x: number; y: number }) => void
  size?: number
  uploading?: boolean
  // Overrides the default gold ring with a caller-supplied color (the email signature's own
  // accent, in Studio's Customize tab) - defaults to the original fixed gold everywhere else
  // (Settings' own photo cropper) that doesn't have an "accent color" concept of its own.
  ringColor?: string
}) {
  const dragStart = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null)
  const lastReported = useRef<{ x: number; y: number } | null>(null)
  const pos = position || { x: 50, y: 50 }

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!dragStart.current || !url) return
    const dx = clientX - dragStart.current.startX
    const dy = clientY - dragStart.current.startY
    const nextX = Math.max(0, Math.min(100, dragStart.current.x - dx * 0.6))
    const nextY = Math.max(0, Math.min(100, dragStart.current.y - dy * 0.6))
    const next = { x: Math.round(nextX), y: Math.round(nextY) }
    lastReported.current = next
    onPositionChange(next)
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 ${ringColor ? '' : 'ring-2 ring-[#C9A24D]/30'} ${url ? 'touch-none cursor-grab select-none active:cursor-grabbing' : ''}`}
      style={{ width: size, height: size, backgroundImage: url ? `url(${url})` : undefined, backgroundSize: 'cover', backgroundPosition: `${pos.x}% ${pos.y}%`, boxShadow: ringColor ? `0 0 0 2px ${ringColor}66` : undefined }}
      title={url ? 'Drag to reposition' : undefined}
      onPointerDown={(event) => {
        if (!url) return
        dragStart.current = { startX: event.clientX, startY: event.clientY, x: pos.x, y: pos.y }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => updateFromPointer(event.clientX, event.clientY)}
      onPointerUp={() => { dragStart.current = null; if (lastReported.current) onDragEnd?.(lastReported.current) }}
      onPointerCancel={() => { dragStart.current = null }}
    >
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}
    </div>
  )
}
