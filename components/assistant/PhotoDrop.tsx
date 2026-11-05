'use client'

import { useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import api from '@/lib/api-service'

export type DroppedPhoto = { id: string; url: string; png_url?: string | null }

const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/** One upload, for the chat box and the cards alike. Says why in plain words when it can't. */
export async function uploadChatPhoto(file: File): Promise<{ photo?: DroppedPhoto; error?: string }> {
  if (file.type && !OK_TYPES.includes(file.type)) return { error: 'That has to be a JPG, PNG or WebP photo.' }
  if (file.size > 12 * 1024 * 1024) return { error: 'That photo is over 12MB - try a smaller one.' }
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
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => { take(e.target.files?.[0]); e.target.value = '' }} />
      {error && <p className="mt-1 text-[11px] font-bold text-red-600 dark:text-red-400" role="alert">{error}</p>}
    </div>
  )
}
