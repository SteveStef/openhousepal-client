import type { Metadata } from 'next'
import CmaZoomGuard from '@/components/cma/CmaZoomGuard'

// The browser tab / search result title for this page (the root layout only sets the site-wide one).
export const metadata: Metadata = { title: 'CMA | OpenHousePal' }

export default function CmaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* No zoom-in on phones anywhere in the CMA section (see the component). */}
      <CmaZoomGuard />
      {children}
    </>
  )
}
