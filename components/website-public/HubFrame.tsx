'use client'

import { useEffect, useRef } from 'react'

// The agent's Hub framed on their website's About / Sales pages. The Hub wears the website's light/dark
// look (owner, 11/09): this tells it the site's current mode each time a page loads inside the frame and
// whenever the visitor flips the site's sun/moon switch (SiteShell's data-mode) - see lib/idxFrameMode.
export default function HubFrame({ src, title, className }: { src: string; title: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const frame = ref.current
    const shell = document.getElementById('ohp-site-shell')
    if (!frame || !shell) return
    const send = () => {
      const mode = shell.getAttribute('data-mode') === 'dark' ? 'dark' : 'light'
      try { frame.contentWindow?.postMessage({ type: 'ohp-idx-mode', mode }, '*') } catch { /* frame gone */ }
    }
    frame.addEventListener('load', send)
    const watch = new MutationObserver(send)
    watch.observe(shell, { attributes: true, attributeFilter: ['data-mode'] })
    send()
    return () => { frame.removeEventListener('load', send); watch.disconnect() }
  }, [])
  return <iframe ref={ref} src={src} title={title} className={className} />
}
