'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { FEATURE_TABS } from '@/components/home/featureTabsData'

// Development only: mounts ONE homepage tool demo by its tab key (?tab=idx) at the homepage's
// exact demo width, so a demo can be screenshot / recorded in isolation. Renders nothing in
// production builds.
function Stage() {
  const params = useSearchParams()
  const key = params.get('tab') || 'agenthub'
  const tab = FEATURE_TABS.find(t => t.key === key) || FEATURE_TABS[0]
  const Demo = tab.Demo
  return (
    <div className="min-h-screen bg-[#FAFAF7] py-8 dark:bg-[#0B0B0B]">
      <div id="demo-stage" className="mx-auto w-[672px] max-w-full">
        <Demo key={tab.key} />
      </div>
    </div>
  )
}

export default function DevDemosPage() {
  if (process.env.NODE_ENV === 'production') return null
  return <Suspense fallback={null}><Stage /></Suspense>
}
