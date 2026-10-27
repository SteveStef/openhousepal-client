'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The admin's town page preview (app/admin/town-preview/[areaId]): the "Admin preview" ribbon, and
 * a guard so nothing on the page does anything real.
 * - Jumps within the page and the page's own price filter / "Show more homes" stay in the preview.
 * - Other links open the agent's real website in a new tab (with no agent, there is none: a note says so).
 * - Form buttons (Ask me, I'm buying...) and Explore Nearby (live Google look-ups) are turned off.
 */
export default function TownPreviewChrome({ agentName, hasSite }: { agentName: string | null; hasSite: boolean }) {
  const [note, setNote] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const say = (text: string) => {
      setNote(text)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setNote(''), 3200)
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (!target?.closest) return
      if (target.closest('#explore-nearby') && target.closest('button, a, [role="button"]')) {
        e.preventDefault(); e.stopPropagation()
        say('Explore Nearby looks places up on Google live - it is off in the preview, so nothing is spent.')
        return
      }
      const a = target.closest('a[href]') as HTMLAnchorElement | null
      if (!a) return
      if (a.hasAttribute('data-ohp-form')) {
        e.preventDefault(); e.stopPropagation()
        say(hasSite ? 'This button opens the agent\'s form - it is off in the preview.' : 'This button opens the agent\'s form - there is no agent in this sample.')
        return
      }
      const raw = a.getAttribute('href') || ''
      if (raw.startsWith('#')) return
      let url: URL
      try { url = new URL(a.href, window.location.href) } catch { return }
      if (url.origin === window.location.origin && url.pathname === window.location.pathname) return
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        e.preventDefault(); e.stopPropagation()
        say('Phone and email links are off in the preview.')
        return
      }
      if (url.origin !== window.location.origin || hasSite) {
        // Outside sources (school, place and data links) and the agent's own site: a new tab.
        e.preventDefault(); e.stopPropagation()
        window.open(url.toString(), '_blank', 'noopener')
        return
      }
      e.preventDefault(); e.stopPropagation()
      say('This link goes to the agent\'s own website - there is no agent in this sample.')
    }
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null
      if (!form) return
      try {
        if (new URL(form.action, window.location.href).pathname === window.location.pathname) return
      } catch { /* fall through */ }
      e.preventDefault(); e.stopPropagation()
      say('Forms are off in the preview.')
    }
    window.addEventListener('click', onClick, true)
    window.addEventListener('submit', onSubmit, true)
    return () => {
      window.removeEventListener('click', onClick, true)
      window.removeEventListener('submit', onSubmit, true)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [hasSite])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-[200] flex flex-col items-center gap-2 px-3" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {note && (
        <p role="status" className="max-w-md rounded-2xl bg-white px-4 py-2.5 text-center text-xs font-bold text-[#111827] shadow-xl ring-1 ring-black/10">{note}</p>
      )}
      <p className="max-w-full rounded-2xl bg-[#111827]/90 px-4 py-1.5 text-center text-[11px] font-black leading-snug text-white shadow-lg ring-1 ring-[#C9A24D]/60">
        <span className="text-[#E8C97A]">Admin preview</span> - not a public page
        <span className="block font-semibold text-white/70 sm:ml-1 sm:inline">{agentName ? `as ${agentName}'s site` : 'sample - no agent'}</span>
      </p>
    </div>
  )
}
