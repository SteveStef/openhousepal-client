'use client'

// The open-house sign-in (and the Guest Pass it hands off to) on an IDX agent's own domain. The app
// page runs in a full-screen frame; it posts its path as the guest moves (sign-in -> Guest Pass ->
// Similar Homes ...), and this keeps the agent-domain address bar in step, so a refresh or a saved
// link reopens the same view on the agent's domain.
import { useEffect } from 'react'

export default function OpenHouseFrame({ src, basePrefix }: { src: string; basePrefix: string }) {
  useEffect(() => {
    const frameOrigin = new URL(src, window.location.href).origin
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== frameOrigin || e.data?.type !== 'ohp:path') return
      const path = String(e.data.path || '')
      if (!path.startsWith('/open-house/')) return
      const next = `${basePrefix}${path}`
      if (next !== window.location.pathname + window.location.search) window.history.replaceState(null, '', next)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [src, basePrefix])

  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#0B0B0B]">
      <iframe src={src} title="Open house" allow="fullscreen; clipboard-write" className="h-full w-full border-0" />
    </main>
  )
}
