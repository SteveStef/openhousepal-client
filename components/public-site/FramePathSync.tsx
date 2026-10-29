'use client'

// A framed app page on an IDX agent's own domain (the client's Showcase) posts its path as the
// visitor moves - opening a home, stepping to the next one, closing it - and this keeps the agent's
// address bar in step, so a refresh or a copied link reopens the same home on the agent's domain
// (same idea as OpenHouseFrame). Renders nothing.
//
// It also tells the frame how much of the phone's bottom edge is covered (user, 10/28): the frame
// now runs to the very bottom of an iPhone, under Safari's bottom bar - it used to stop short and
// leave an empty band there - and inside a frame the page can't measure that edge itself.
import { useEffect } from 'react'

export default function FramePathSync({ src, basePrefix, prefix }: { src: string; basePrefix: string; prefix: string }) {
  useEffect(() => {
    const frameOrigin = new URL(src, window.location.href).origin
    const frame = () => Array.from(document.querySelectorAll('iframe')).find(f => f.src && new URL(f.src, window.location.href).origin === frameOrigin) || null

    // env(safe-area-inset-bottom) of this page, read off a hidden probe.
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)'
    document.body.appendChild(probe)
    const sendSafeArea = () => {
      const bottom = parseFloat(getComputedStyle(probe).paddingBottom) || 0
      try { frame()?.contentWindow?.postMessage({ type: 'ohp:safe-area', bottom }, frameOrigin) } catch { /* frame gone */ }
    }

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== frameOrigin) return
      if (e.data?.type === 'ohp:safe-area?') { sendSafeArea(); return }
      if (e.data?.type !== 'ohp:path') return
      const path = String(e.data.path || '')
      // Only this page's own paths (/showcase/<code> or /showcase/<code>/<home>) - nothing else.
      if (!path.startsWith(prefix) || !/^\/[\w\-/%]+$/.test(path) || path.includes('//')) return
      const next = `${basePrefix}${path}`
      if (next !== window.location.pathname) window.history.replaceState(window.history.state, '', next)
    }
    window.addEventListener('message', onMessage)
    const el = frame()
    el?.addEventListener('load', sendSafeArea)
    window.addEventListener('resize', sendSafeArea)
    window.visualViewport?.addEventListener('resize', sendSafeArea)
    return () => {
      window.removeEventListener('message', onMessage)
      el?.removeEventListener('load', sendSafeArea)
      window.removeEventListener('resize', sendSafeArea)
      window.visualViewport?.removeEventListener('resize', sendSafeArea)
      probe.remove()
    }
  }, [src, basePrefix, prefix])
  return null
}
