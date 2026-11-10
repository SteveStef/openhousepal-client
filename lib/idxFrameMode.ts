'use client'

import { useEffect, useState } from 'react'

// The Agent Hub (and its Sales page / forms) shown INSIDE an agent's IDX website - the site's About and
// Sales pages frame it with ?idx_light=1 (the name is older than this: it means "inside the website").
// It wears the website's light/dark look, not its own (owner, 11/09): ?idx_mode=dark|light says which
// at load, and the website's frame (components/website-public/HubFrame) posts {type:'ohp-idx-mode'}
// whenever the visitor flips the site's sun/moon switch, so the two always match.
export function useIdxFrameMode(searchParams: { get(name: string): string | null }) {
  const inIdx = searchParams.get('idx_light') === '1'
  const [idxDark, setIdxDark] = useState(inIdx && searchParams.get('idx_mode') === 'dark')
  useEffect(() => {
    if (!inIdx) return
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; mode?: string } | null
      if (d && d.type === 'ohp-idx-mode' && (d.mode === 'dark' || d.mode === 'light')) setIdxDark(d.mode === 'dark')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [inIdx])
  return { inIdx, idxDark }
}
