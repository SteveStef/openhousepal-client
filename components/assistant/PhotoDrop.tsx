'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import api from '@/lib/api-service'

export type DroppedPhoto = { id: string; url: string; png_url?: string | null }

const MAX_BYTES = 12 * 1024 * 1024
const MAX_ORIGINAL_BYTES = 60 * 1024 * 1024   // bigger than any phone photo: never even opened
const MAX_SIDE = 2560       // plenty for anything the chat makes; a phone's 48MP photo is 8064px
const SHRINK_OVER = 3 * 1024 * 1024
// Every photo a phone can hand over. "image/*" so an iPhone offers Photos, the camera and Files.
export const PHOTO_ACCEPT = 'image/*,.heic,.heif'
const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)
/** iPhones sometimes hand over a photo with no type at all, so the name counts too. */
export const isPhotoFile = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|hei[cf])$/i.test(f.name)

// Phone photos are big and often HEIC (owner, 11/05: a photo from an iPhone wouldn't go in). Redrawn at
// a sensible size as a JPG here, so the upload is quick on cell service and upright. A browser that
// can't read the file (HEIC on a Windows computer) sends the original and the server converts it.
// PNGs stay as they are: a logo needs its see-through background.
async function readyToSend(file: File, { over = SHRINK_OVER, side = MAX_SIDE } = {}): Promise<File> {
  const png = file.type === 'image/png'
  if (png ? file.size <= MAX_BYTES : !isHeic(file) && !!file.type && file.size <= over) return file
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error('unreadable')); img.src = url })
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.9))
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`, { type: 'image/jpeg' }) : file
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Media Lab keeps full quality: only a photo past the limit, or an iPhone HEIC, is redrawn, and larger. */
export const fitForMediaLab = (file: File) => (file.size > MAX_ORIGINAL_BYTES ? Promise.resolve(file) : readyToSend(file, { over: MAX_BYTES, side: 4096 }))

/** One upload, for the chat box and the cards alike. Says why in plain words when it can't. */
export async function uploadChatPhoto(original: File): Promise<{ photo?: DroppedPhoto; error?: string }> {
  if (!isPhotoFile(original)) return { error: "That isn't a photo - try a JPG, PNG or iPhone photo." }
  if (original.size > MAX_ORIGINAL_BYTES) return { error: 'That file is too big - try a smaller photo.' }
  const file = await readyToSend(original)
  if (file.size > MAX_BYTES) return { error: 'That photo is over 12MB - try a smaller one.' }
  const r = await api.ai.uploadAttachment(file)
  return r.success && r.data ? { photo: r.data } : { error: r.error || "Couldn't add that photo - try again." }
}

// A spot on a card to drop a photo on or tap to choose one (owner, 11/05: "even dragging and dropping
// a photo in"). The drop stops here, so it never also lands on the chat box behind it.
export function PhotoDrop({ onPhoto, label = 'Drop a photo here, or tap to choose', testid = 'ai-photo-drop', compact = false }: {
  onPhoto: (p: DroppedPhoto) => void; label?: string; testid?: string; compact?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const take = async (file?: File | null) => {
    if (!file || busy) return
    setBusy(true); setError('')
    const { photo, error: bad } = await uploadChatPhoto(file)
    setBusy(false)
    if (photo) onPhoto(photo)
    else setError(bad || '')
  }
  return (
    <div>
      <button type="button" onClick={() => input.current?.click()} disabled={busy} data-testid={testid}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); setOver(false); take(e.dataTransfer.files?.[0]) }}
        className={`ohp-ai-press flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed text-xs font-bold transition-colors ${compact ? 'px-3 py-2' : 'px-3 py-4'} ${over
          ? 'border-[#C9A24D] bg-[#C9A24D]/10 text-[#8b7355] dark:text-[#e8c97a]' : 'border-gray-300 bg-white/70 text-gray-600 hover:border-[#C9A24D]/70 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-300'}`}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 text-[#C9A24D]" />}
        {busy ? 'Adding your photo...' : label}
      </button>
      <input ref={input} type="file" accept={PHOTO_ACCEPT} className="hidden"
        onChange={e => { take(e.target.files?.[0]); e.target.value = '' }} />
      {error && <p className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  )
}
