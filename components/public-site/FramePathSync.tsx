'use client'

// A framed app page on an IDX agent's own domain (the client's Showcase) posts its path as the
// visitor moves - opening a home, stepping to the next one, closing it - and this keeps the agent's
// address bar in step, so a refresh or a copied link reopens the same home on the agent's domain
// (same idea as OpenHouseFrame). Renders nothing.
import { useEffect } from 'react'

export default function FramePathSync({ src, basePrefix, prefix }: { src: string; basePrefix: string; prefix: string }) {
  useEffect(() => {
    const frameOrigin = new URL(src, window.location.href).origin
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== frameOrigin || e.data?.type !== 'ohp:path') return
      const path = String(e.data.path || '')
      // Only this page's own paths (/showcase/<code> or /showcase/<code>/<home>) - nothing else.
      if (!path.startsWith(prefix) || !/^\/[\w\-/%]+$/.test(path) || path.includes('//')) return
      const next = `${basePrefix}${path}`
      if (next !== window.location.pathname) window.history.replaceState(window.history.state, '', next)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [src, basePrefix, prefix])
  return null
}
