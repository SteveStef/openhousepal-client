'use client'

// Downloading a Studio design (owner 10/24): on a phone the PNG / PDF opens the phone's Share
// sheet ("Save Image", "Save to Files", AirDrop...) instead of landing in Downloads; on a computer
// it simply downloads (lib/mobileShare rule).
//
// The file is rendered on the server and that takes a few seconds - longer than iPhone Safari keeps
// a tap "alive" for the Share sheet. So on phones:
//   - prebuild() makes the file ahead of time (the "Design created" screen, an opened design), and a
//     tap on Download hands the ready file to the Share sheet instantly;
//   - tapped before it's ready, the file is built, the Share sheet is tried, and if the phone says
//     the tap expired a small sheet slides up with the image and one big "Save image" button - that
//     second tap always works.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, FileText, Share2 } from 'lucide-react'
import api from '@/lib/api-service'
import OhSheet from '@/components/open-house-manager/OhSheet'
import { downloadBlob, isTouchPhone } from '@/lib/mobileShare'

export type DesignFileKind = 'png' | 'pdf'
export type DesignSaveResult = 'shared' | 'downloaded' | 'cancelled' | 'waiting' | 'error'

const fileNameFor = (name: string | null | undefined, kind: DesignFileKind) =>
  `${(name || 'design').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90) || 'design'}.${kind}`

async function build(id: string, kind: DesignFileKind): Promise<Blob | null> {
  const res = kind === 'png' ? await api.designs.exportPng(id) : await api.designs.exportPdf(id)
  return res.success && res.blob ? res.blob : null
}

/** Opens the Share sheet with the file. 'expired' = the phone refused because the tap is too old. */
async function shareFile(file: File): Promise<'shared' | 'cancelled' | 'expired' | 'unsupported'> {
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported'
  try {
    // the file only - a title also lands as a second "text" file in iOS Save to Files
    await navigator.share({ files: [file] })
    return 'shared'
  } catch (e) {
    const n = (e as Error)?.name
    if (n === 'AbortError') return 'cancelled'
    return 'expired'
  }
}

export function useDesignSaver() {
  const [busy, setBusy] = useState<DesignFileKind | null>(null)
  const [ready, setReady] = useState<{ file: File; kind: DesignFileKind; url: string | null } | null>(null)
  const [phone, setPhone] = useState(false)
  useEffect(() => { setPhone(isTouchPhone()) }, [])
  // id:kind:version -> the built file (or the build in flight)
  const cache = useRef(new Map<string, Promise<Blob | null>>())
  const built = useRef(new Map<string, Blob>())
  const keyOf = (id: string, kind: DesignFileKind, version?: string | null) => `${id}:${kind}:${version || ''}`
  const start = (key: string, id: string, kind: DesignFileKind) => {
    const p = build(id, kind).catch(() => null)
    cache.current.set(key, p)
    p.then(b => { if (b) built.current.set(key, b); else cache.current.delete(key) })
    return p
  }

  /** Build the file now so a later tap can share it instantly (phones only - computers don't need it). */
  const prebuild = useCallback((id: string, kind: DesignFileKind, version?: string | null) => {
    if (!isTouchPhone()) return
    const key = keyOf(id, kind, version)
    if (cache.current.has(key)) return
    // only the newest version of a design is kept
    for (const k of Array.from(cache.current.keys())) if (k.startsWith(`${id}:${kind}:`)) { cache.current.delete(k); built.current.delete(k) }
    start(key, id, kind)
  }, [])

  const save = useCallback(async (id: string, name: string | null | undefined, kind: DesignFileKind, version?: string | null): Promise<DesignSaveResult> => {
    const fileName = fileNameFor(name, kind)
    const type = kind === 'png' ? 'image/png' : 'application/pdf'
    if (!isTouchPhone()) {
      setBusy(kind)
      try {
        const blob = await build(id, kind)
        if (!blob) return 'error'
        downloadBlob(blob, fileName)
        return 'downloaded'
      } finally { setBusy(null) }
    }
    const key = keyOf(id, kind, version)
    let pending = cache.current.get(key)
    // A file that's already built goes straight to the Share sheet, inside this tap.
    const settled = built.current.get(key)
    if (settled) {
      const file = new File([settled], fileName, { type })
      const r = await shareFile(file)
      if (r === 'shared') return 'shared'
      if (r === 'cancelled') return 'cancelled'
      if (r === 'unsupported') { downloadBlob(settled, fileName); return 'downloaded' }
      setReady({ file, kind, url: kind === 'png' ? URL.createObjectURL(settled) : null })
      return 'waiting'
    }
    setBusy(kind)
    try {
      if (!pending) pending = start(key, id, kind)
      const blob = await pending
      if (!blob) { cache.current.delete(key); return 'error' }
      const file = new File([blob], fileName, { type })
      const r = await shareFile(file)
      if (r === 'shared') return 'shared'
      if (r === 'cancelled') return 'cancelled'
      if (r === 'unsupported') { downloadBlob(blob, fileName); return 'downloaded' }
      // the tap went stale while the file was being made - one more tap opens the Share sheet
      setReady({ file, kind, url: kind === 'png' ? URL.createObjectURL(blob) : null })
      return 'waiting'
    } finally { setBusy(null) }
  }, [])

  const closeReady = useCallback(() => setReady(r => { if (r?.url) setTimeout(() => URL.revokeObjectURL(r.url!), 1000); return null }), [])

  const sheet = (
    <OhSheet open={!!ready} onClose={closeReady} width="max-w-md"
      title={ready?.kind === 'pdf' ? 'Your PDF is ready' : 'Your image is ready'}
      subtitle="Tap below to save it to your phone"
      icon={ready?.kind === 'pdf' ? <FileText className="h-5 w-5" /> : <Download className="h-5 w-5" />}
      footer={ready && (
        <button type="button" data-testid="design-save-ready"
          onClick={async () => {
            const r = await shareFile(ready.file)
            if (r === 'unsupported' || r === 'expired') downloadBlob(ready.file, ready.file.name)
            if (r !== 'cancelled') closeReady()
          }}
          className="lx-shine relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#b8913f] via-[#C9A24D] to-[#e8c97a] py-4 text-[15px] font-black text-[#111827] shadow-lg shadow-[#C9A24D]/30 active:scale-[0.98]">
          <Share2 className="h-5 w-5" /> {ready.kind === 'pdf' ? 'Save PDF' : 'Save image'}
        </button>
      )}>
      <div className="flex justify-center p-5">
        {ready?.url
          ? <img src={ready.url} alt="" className="max-h-[46dvh] w-auto max-w-full rounded-lg shadow-[0_24px_50px_-20px_rgba(0,0,0,.5)]" />
          : <div className="grid h-40 w-32 place-items-center rounded-xl bg-white shadow-md dark:bg-white/10"><FileText className="h-10 w-10 text-[#C9A24D]" /></div>}
      </div>
    </OhSheet>
  )

  return { save, prebuild, busy, phone, sheet }
}
