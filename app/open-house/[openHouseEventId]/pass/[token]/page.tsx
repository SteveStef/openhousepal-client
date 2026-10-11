'use client'

import { useParams } from 'next/navigation'
import GuestPass from '@/components/guest-pass/GuestPass'
import { ToastProvider } from '@/contexts/ToastContext'

// A guest's Guest Pass - opened right after they sign in at this open house (see GuestPass).
// Open house pages render without the app's providers (proxy.ts marks them public), and the
// listing details view inside the pass shows toasts - so it brings its own.
export default function GuestPassPage() {
  const { openHouseEventId, token } = useParams()
  return (
    <ToastProvider>
      <GuestPass token={token as string} openHouseEventId={openHouseEventId as string} />
    </ToastProvider>
  )
}
