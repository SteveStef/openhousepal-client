'use client'

// Any page that hits an error while loading or drawing (user, 10/24 - a link that "tried, failed
// and nothing ever happened", a black screen): never a blank page. A failed download of the page's
// own code (a deploy moments ago / a dropped request) quietly reloads once; anything else gets a
// clear card with "Try again". No OpenHousePal logo - this can be a client's page.
import { useEffect, useState } from 'react'

const CHUNK = /ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reloading, setReloading] = useState(false)
  useEffect(() => {
    if (!CHUNK.test(`${error?.name || ''}: ${error?.message || ''}`)) return
    try {
      const last = +(sessionStorage.getItem('ohp-chunk-reload') || 0)
      if (Date.now() - last < 20000) return
      sessionStorage.setItem('ohp-chunk-reload', String(Date.now()))
    } catch { return }
    setReloading(true)
    window.location.reload()
  }, [error])

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#faf9f7] px-5 py-16 dark:bg-[#0B0B0B]">
      <div className="w-full max-w-sm rounded-3xl border border-black/[0.06] bg-white p-8 text-center shadow-[0_24px_50px_-34px_rgba(0,0,0,.45)] dark:border-white/[0.08] dark:bg-[#151517]">
        <svg viewBox="0 3 40 44" className="mx-auto h-12 w-auto text-[#111827] dark:text-white" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3.5 22.5 L20 8 L36.5 22.5" /><path d="M7 20 V43 H14.5 M25.5 43 H33 V20" />
          <path d="M25.5 46 V29.5 L19.5 31.8 V46 Z" fill="#C9A24D" stroke="none" />
        </svg>
        <h1 className="mt-5 font-serif text-2xl font-black text-[#111827] dark:text-white">{reloading ? 'One moment…' : 'That didn’t load'}</h1>
        <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
          {reloading ? 'Opening it again.' : 'Your connection may have dropped for a second. Try again - it usually opens right away.'}
        </p>
        {!reloading && (
          <div className="mt-6 flex flex-col gap-2">
            <button type="button" onClick={() => reset()} className="rounded-2xl bg-[#111827] px-5 py-3 text-xs font-black uppercase tracking-widest text-white dark:bg-white dark:text-[#111827]">Try again</button>
            <button type="button" onClick={() => window.location.reload()} className="rounded-2xl border border-gray-200 px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-600 dark:border-white/15 dark:text-gray-300">Reload the page</button>
          </div>
        )}
      </div>
    </div>
  )
}
