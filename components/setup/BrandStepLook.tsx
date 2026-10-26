'use client'

// The setup flow's Brand step look picker - drop-in, self-contained (reads and saves the Brand Kit
// itself through lib/brandKit, no props needed):
//
//   import BrandStepLook from '@/components/setup/BrandStepLook'
//   <BrandStepLook />                      // look + color + Ivory/Midnight + live preview
//   <BrandStepLook onSaved={() => ...} />  // e.g. mark the step confirmed after the first pick
//
// Same choices as Studio -> Brand Kit (components/studio/BrandLookPicker): Classic / Luxe (IDX),
// the Agent Hub / IDX color palette (lib/brandKit BRAND_COLORS) or Luxe's gold / silver / bronze,
// and Ivory / Midnight. Every feature still on "My Brand Kit" (Agent Hub, IDX website, forms, email
// signature) changes with it.
import { useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { luxeAllowedFor, useBrandKit, type BrandKitPatch } from '@/lib/brandKit'
import type { BrandKit } from '@/types'
import BrandLookPicker from '@/components/studio/BrandLookPicker'
import { useSaveTracker } from '@/components/ui/SaveStatus'

export default function BrandStepLook({ onSaved, showPreview = true }: { onSaved?: () => void; showPreview?: boolean }) {
  const { user } = useAuth()
  const { kit, loading, save, setLocal } = useBrandKit()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Inside the setup flow the page's save status (sticky header) shows this save too.
  const tracker = useSaveTracker()
  // Everything picked but not saved yet, sent as one patch (a failed one is kept for Try again).
  const waiting = useRef<BrandKitPatch>({})
  const merge = (a: BrandKitPatch, b: BrandKitPatch): BrandKitPatch => ({ ...a, ...b, ...(a.look || b.look ? { look: { ...a.look, ...b.look } } : {}) })

  const send = async () => {
    const patch = waiting.current
    if (!Object.keys(patch).length) return { success: true }
    waiting.current = {}
    setStatus('saving')
    const r = await save(patch)
    setStatus(r.success ? 'saved' : 'error')
    if (r.success) onSaved?.()
    else waiting.current = merge(patch, waiting.current)
    return r
  }
  const run = () => tracker ? tracker.track(send, { key: 'brand-look', retry: send }) : send()

  const change = (patch: BrandKitPatch) => {
    if (!kit) return
    // Show it at once, save right behind it (colors wait a moment - the picker can be dragged).
    const optimistic: BrandKit = {
      ...kit,
      ...(patch.secondary_color ? { secondary_color: patch.secondary_color } : {}),
      ...(patch.look ? { look: { theme: 'classic', metal: 'gold', dark: false, ...(kit.look || {}), ...patch.look, saved: true } } : {}),
    }
    setLocal(optimistic)
    waiting.current = merge(waiting.current, patch)
    if (patch.secondary_color) {
      if (colorTimer.current) clearTimeout(colorTimer.current)
      if (tracker) tracker.schedule('brand-look', send, 400, { retry: send })
      else { setStatus('saving'); colorTimer.current = setTimeout(() => { void send() }, 400) }
    } else void run()
  }

  if (loading && !kit) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#C9A24D]" /></div>
  }

  return (
    <div data-testid="brand-step-look">
      <BrandLookPicker kit={kit} luxeAllowed={luxeAllowedFor(user)} onChange={change} showPreview={showPreview} />
      {/* In the setup flow the header shows Saving… / Saved / Try again; this line just says what a save does. */}
      <p className="mt-3 flex min-h-[18px] items-center gap-1.5 text-[11px] font-bold text-gray-400" aria-live="polite">
        {!tracker && status === 'saving' && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
        {status === 'saved' && <><Check className="h-3 w-3 text-emerald-500" /> Saved - your Agent Hub, website, forms and signature use it.</>}
        {!tracker && status === 'error' && <span className="text-red-500">That didn&apos;t save - try again.</span>}
      </p>
    </div>
  )
}
