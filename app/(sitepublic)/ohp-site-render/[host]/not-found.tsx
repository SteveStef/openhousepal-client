'use client'

import { usePathname } from 'next/navigation'

// "Page not found" on an agent's own website - the visitor is a home buyer or seller, usually
// arriving from an old link to a home that has since sold or come off the market. (The app-wide
// 404 speaks to agents.) Links stay on the agent's site: on their real domain the base is "/",
// on the preview address it's /ohp-site-render/<host>.
export default function SiteNotFound() {
  const pathname = usePathname() || ''
  const m = pathname.match(/^\/ohp-site-render\/[^/]+/)
  const base = m ? m[0] : ''
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-[#FAFAF7] px-6 py-24 text-center dark:bg-[#0B0B0B]">
      <div className="max-w-md">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#C9A24D]">Page not found</p>
        <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-[#111827] dark:text-white">This page has moved on</h1>
        <p className="mt-4 text-base leading-relaxed text-gray-600 dark:text-gray-400">
          If you followed a link to a home, it may have sold or come off the market. There are plenty more to see.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={`${base}/search`} className="rounded-xl bg-[#111827] px-7 py-3.5 font-bold text-white transition hover:bg-[#C9A24D] dark:bg-white dark:text-[#111827]">
            Search homes
          </a>
          <a href={`${base}/` || '/'} className="rounded-xl border border-gray-200 bg-white px-7 py-3.5 font-bold text-[#111827] transition hover:bg-gray-50 dark:border-gray-800 dark:bg-[#151517] dark:text-white">
            Home page
          </a>
        </div>
      </div>
    </main>
  )
}
